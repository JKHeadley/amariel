import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { nanoid } from 'nanoid';
import { InteractionType } from '@prisma/client';

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

  try {
    const { type, text, username, replyToId } = req.body;

    // Generate a mock tweet ID
    const tweetId = `mock_${nanoid()}`;
    const timestamp = new Date();

    if (type === 'REPLY' && replyToId) {
      // Fetch the original tweet to get its conversation ID
      const originalTweet = await prisma.tweet.findUnique({
        where: { id: replyToId }
      });

      if (!originalTweet) {
        return res.status(404).json({ error: 'Original tweet not found' });
      }

      // Create a mock reply
      const reply = await prisma.tweet.create({
        data: {
          id: tweetId,
          text,
          authorId: `mock_${username}`,
          createdAt: timestamp,
          isMock: true,
          conversationId: originalTweet.conversationId || originalTweet.id,
          inReplyToId: replyToId,
          metrics: {
            replyCount: 0,
            retweetCount: 0,
            likeCount: 0
          }
        }
      });

      // Create a mention to trigger Amariel's response
      await prisma.mention.create({
        data: {
          id: `mock_mention_${nanoid()}`,
          text,
          authorId: `mock_${username}`,
          createdAt: timestamp,
          isMock: true,
          conversationId: reply.conversationId,
          inReplyToId: replyToId,
          type: InteractionType.REPLY,
          status: 'PENDING',
          statusReason: 'Mock reply created for testing'
        }
      });

      return res.status(200).json(reply);
    } else {
      // Create a mock mention tweet
      const tweet = await prisma.tweet.create({
        data: {
          id: tweetId,
          text,
          authorId: `mock_${username}`,
          createdAt: timestamp,
          isMock: true,
          conversationId: tweetId,  // New conversation
          metrics: {
            replyCount: 0,
            retweetCount: 0,
            likeCount: 0
          }
        }
      });

      // Create a mention to trigger Amariel's response
      await prisma.mention.create({
        data: {
          id: `mock_mention_${nanoid()}`,
          text,
          authorId: `mock_${username}`,
          createdAt: timestamp,
          isMock: true,
          conversationId: tweet.id,
          type: InteractionType.MENTION,
          status: 'PENDING',
          statusReason: 'Mock mention created for testing'
        }
      });

      return res.status(200).json(tweet);
    }
  } catch (error) {
    console.error('Error creating mock interaction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 