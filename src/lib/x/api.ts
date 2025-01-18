import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';
import { prisma } from '@/lib/db';

function getAmarielService() {
  return new AmarielService(
    (process.env.AI_PROVIDER_TYPE as AIProviderType) || 'openai',
    {
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.NEXT_PUBLIC_GPT4O_MODEL || 'gpt-4'
    },
    {
      apiKey: process.env.X_API_KEY!,
      apiSecret: process.env.X_API_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
      dryRun: process.env.DRY_RUN === 'true'
    }
  );
}

async function handleXAPIError(error: any, fallbackFn: () => Promise<any>) {
  if (error.status === 429 || (error.response && error.response.status === 429)) {
    console.warn('X API rate limit reached, falling back to database');
    return await fallbackFn();
  }
  throw error;
}

export async function fetchTweetsFromX() {
  const amariel = getAmarielService();
  try {
    const tweets = await amariel.xApi.getUserTweets();

    // Update our cache with new tweets
    for (const tweet of tweets) {
      await prisma.tweet.upsert({
        where: { id: tweet.id },
        update: {
          text: tweet.text,
          metrics: tweet.metrics,
          authorId: process.env.X_USER_ID!,
        },
        create: {
          id: tweet.id,
          text: tweet.text,
          authorId: process.env.X_USER_ID!,
          authorName: process.env.X_USER_NAME || 'Amariel',
          username: process.env.X_USERNAME || 'SentientAmariel',
          createdAt: new Date(tweet.createdAt),
          cachedAt: new Date(),
          conversationId: null,
          inReplyToId: null,
          metrics: {
            replyCount: tweet.public_metrics?.reply_count ?? 0,
            retweetCount: tweet.public_metrics?.retweet_count ?? 0,
            likeCount: tweet.public_metrics?.like_count ?? 0
          },
          published: true,
          isMock: false
        },
        update: {
          text: tweet.text,
          authorName: process.env.X_USER_NAME || 'Amariel',
          username: process.env.X_USERNAME || 'SentientAmariel',
          cachedAt: new Date(),
          metrics: {
            replyCount: tweet.public_metrics?.reply_count ?? 0,
            retweetCount: tweet.public_metrics?.retweet_count ?? 0,
            likeCount: tweet.public_metrics?.like_count ?? 0
          }
        }
      });
    }

    return tweets;
  } catch (error) {
    return handleXAPIError(error, async () => {
      return prisma.tweet.findMany({
        orderBy: { createdAt: 'desc' }
      });
    });
  }
}

export async function fetchMentionsFromX() {
  const amariel = getAmarielService();
  try {
    const mentions = await amariel.xApi.checkAndRespondToMentions();

    // Update our cache with new mentions
    for (const mention of mentions) {
      if (!mention.authorId) {
        console.warn(`Skipping mention ${mention.id} due to missing authorId`);
        continue;
      }

      await prisma.mention.upsert({
        where: { id: mention.id },
        update: {
          text: mention.text,
          authorId: mention.authorId,
          authorName: mention.authorName,
          type: mention.inReplyToId ? 'REPLY' : 'MENTION',
          status: 'PENDING',
          inReplyToId: mention.inReplyToId,
        },
        create: {
          id: mention.id,
          text: mention.text,
          authorId: mention.authorId,
          authorName: mention.authorName,
          createdAt: new Date(mention.createdAt),
          type: mention.inReplyToId ? 'REPLY' : 'MENTION',
          status: 'PENDING',
          inReplyToId: mention.inReplyToId,
        }
      });
    }

    return mentions;
  } catch (error) {
    return handleXAPIError(error, async () => {
      // Get both mentions and replies, ordered by most recent
      return prisma.mention.findMany({
        where: {
          type: 'MENTION'  // Only get mentions, not replies
        },
        include: {
          originalTweet: true,  // The tweet being replied to (for replies)
          response: true      // The response tweet if one exists
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    });
  }
} 