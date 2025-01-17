import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { getDataWithCache } from '@/lib/x/cache';
import { fetchTweetsFromX } from '@/lib/x/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const posts = await getDataWithCache({
        type: 'tweet',
        fetchFromX: fetchTweetsFromX,
        getFromDb: () => prisma.tweet.findMany({
          where: {
            authorId: process.env.X_USER_ID,
            published: true,
            NOT: {
              mentions: {
                some: {
                  type: 'MENTION'
                }
              }
            }
          },
          include: {
            mentions: true,
            parentTweet: true,
            childTweets: true,
            replies: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
      });

      return res.status(200).json({ posts });
    } catch (error) {
      console.error('Error fetching posts:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle POST requests for creating new tweets
  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { text, inReplyToId } = req.body;

    try {
      const tweet = await prisma.tweet.create({
        data: {
          id: `mock_${Math.random().toString(36).substring(2)}`,
          text,
          authorId: process.env.X_USER_ID!,
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
    } catch (error) {
      console.error('Error creating tweet:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 