import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';
import { prisma } from '@/lib/db';
import { Tweet, Mention } from '@prisma/client';

// Define the TwitterAPITweet interface here since it's not exported from x-api
interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

interface TwitterAPITweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  includes?: {
    users?: TwitterUser[];
  };
  referenced_tweets?: Array<{
    type: 'replied_to' | 'quoted' | 'retweeted';
    id: string;
  }>;
}

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
  console.log('🔍 Fetching tweets from X');
  const amariel = getAmarielService();
  try {
    // @ts-ignore - xApi is private but we need to access it here
    const tweets = await amariel.xApi.getUserTweets();

    // Update our cache with new tweets
    for (const tweet of tweets) {
      const metrics = {
        replyCount: (tweet as any).metrics?.replyCount ?? 0,
        retweetCount: (tweet as any).metrics?.retweetCount ?? 0,
        likeCount: (tweet as any).metrics?.likeCount ?? 0
      };

      await prisma.tweet.upsert({
        where: { id: tweet.id },
        create: {
          id: tweet.id,
          text: tweet.text,
          authorId: process.env.X_USER_ID!,
          authorName: process.env.X_USERNAME || 'Amariel',
          username: process.env.X_USERNAME || 'SentientAmariel',
          createdAt: new Date(tweet.createdAt),
          cachedAt: new Date(),
          conversationId: null,
          inReplyToId: null,
          metrics,
          published: true,
          isMock: false
        },
        update: {
          text: tweet.text,
          authorName: process.env.X_USERNAME || 'Amariel',
          username: process.env.X_USERNAME || 'SentientAmariel',
          cachedAt: new Date(),
          metrics
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
    // @ts-ignore - xApi is private but we need to access it here
    const mentions = await amariel.xApi.checkAndRespondToMentions();

    // Update our cache with new mentions
    for (const mention of mentions) {
      const tweetMention = mention as TwitterAPITweet;
      const author = tweetMention.includes?.users?.find((u: TwitterUser) => u.id === tweetMention.author_id);
      const replyToId = tweetMention.referenced_tweets?.find((ref: { type: string; id: string }) => ref.type === 'replied_to')?.id;

      if (!tweetMention.author_id) {
        console.warn(`Skipping mention ${tweetMention.id} due to missing author_id`);
        continue;
      }

      await prisma.mention.upsert({
        where: { id: tweetMention.id },
        update: {
          text: tweetMention.text,
          authorId: tweetMention.author_id,
          authorName: author?.name || 'Unknown User',
          username: author?.username || 'unknown',
          type: replyToId ? 'REPLY' : 'MENTION',
          status: 'PENDING',
          inReplyToId: replyToId
        },
        create: {
          id: tweetMention.id,
          text: tweetMention.text,
          authorId: tweetMention.author_id,
          authorName: author?.name || 'Unknown User',
          username: author?.username || 'unknown',
          createdAt: new Date(tweetMention.created_at),
          type: replyToId ? 'REPLY' : 'MENTION',
          status: 'PENDING',
          inReplyToId: replyToId
        }
      });
    }

    return mentions;
  } catch (error) {
    return handleXAPIError(error, async () => {
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