import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';
import { MentionStatus } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const mentionId = req.query.mentionId as string;

  try {
    // Get the mention with its chat messages and relevant tweets
    const mention = await prisma.mention.findUnique({
      where: { id: mentionId },
      include: {
        chat: {
          include: {
            messages: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1,
              where: {
                role: 'ASSISTANT',
                published: false
              }
            }
          }
        },
        originalTweet: true
      }
    });

    // Add debug logging
    console.log('DEBUG - Full mention object:', JSON.stringify({
      id: mention?.id,
      status: mention?.status,
      originalTweet: mention?.originalTweet,
      conversationId: mention?.conversationId,
      isMock: mention?.isMock
    }, null, 2));

    if (!mention) {
      return res.status(404).json({ error: 'Mention not found' });
    }

    if (!mention.chat || mention.chat.messages.length === 0) {
      return res.status(400).json({ error: 'No response available to post' });
    }

    // Get the latest message (the response to post)
    const response = mention.chat.messages[0];
    console.log('Found response to post:', response.content);

    // Initialize Amariel service
    const amariel = new AmarielService(
      {
        apiKey: process.env.X_API_KEY!,
        apiSecret: process.env.X_API_SECRET!,
        accessToken: process.env.X_ACCESS_TOKEN!,
        accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
        dryRun: process.env.DRY_RUN === 'true'
      }
    );

    // Check if this is a mock interaction
    const isMock = mention.isMock || (mention.originalTweet?.isMock ?? false);
    console.log('Is mock interaction:', isMock);

    // Get the ID of the tweet we're replying to
    const parentTweetId = mentionId;
    console.log('Replying to tweet:', parentTweetId);

    let tweetRecord;

    if (isMock) {
      // For mock tweets, create the tweet record directly
      const responseId = `mock_response_${Date.now()}`;
      tweetRecord = await prisma.tweet.create({
        data: {
          id: responseId,
          text: response.content,
          authorId: process.env.X_USER_ID!,
          authorName: process.env.X_AUTHOR_NAME || 'Sentient_AI_Amariel',
          username: process.env.X_USERNAME || 'SentientAmariel',
          createdAt: new Date(),
          isMock: true,
          conversationId: mention.conversationId,
          inReplyToId: parentTweetId,
          metrics: {
            likeCount: 0,
            replyCount: 0,
            retweetCount: 0
          }
        }
      });
    } else {
      // For real tweets, post to X API
      console.log('Posting tweet with params:', {
        content: response.content,
        conversationId: mention.conversationId,
        isMock,
        parentTweetId
      });

      // Convert null to undefined for parentTweetId
      const replyToId = typeof parentTweetId === 'string' ? parentTweetId : undefined;

      const tweet = await amariel.postTweet(
        response.content,
        mention.conversationId,
        isMock,
        undefined,
        replyToId
      );
      tweetRecord = tweet;
    }

    // Update the mention status
    await prisma.mention.update({
      where: { id: mentionId },
      data: {
        status: MentionStatus.RESPONDED,
        processedAt: new Date(),
        response: {
          connect: { id: tweetRecord.id }
        }
      }
    });

    return res.status(200).json({
      message: 'Response posted successfully',
      tweet: tweetRecord
    });
  } catch (error) {
    console.error('Error posting response:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 