import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';

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

  const { text, inReplyToId, type } = req.body;

  try {
    if (type === 'mention') {
      // Create a mention
      const mention = await prisma.mention.create({
        data: {
          id: `mock_${Math.random().toString(36).substring(2)}`,
          text,
          authorId: 'mock_user',
          authorName: 'Mock User',
          createdAt: new Date(),
          isMock: true,
          type: 'MENTION',
          status: 'PENDING',
          ...(inReplyToId && {
            inReplyToId,
            type: 'REPLY',
          }),
        },
      });
      return res.status(200).json(mention);
    } else {
      // Create a tweet
      const tweet = await prisma.tweet.create({
        data: {
          id: `mock_${Math.random().toString(36).substring(2)}`,
          text,
          authorId: process.env.X_USER_ID!,
          authorName: process.env.X_AUTHOR_NAME!,
          username: process.env.X_USERNAME!,
          createdAt: new Date(),
          isMock: true,
          inReplyToId,
          metrics: {
            replyCount: 0,
            retweetCount: 0,
            likeCount: 0,
          },
        },
      });
      return res.status(200).json(tweet);
    }
  } catch (error) {
    console.error('Error creating mock interaction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 