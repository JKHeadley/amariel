import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const postId = req.query.postId as string;

  try {
    // First get the requested post
    const post = await prisma.tweet.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get only direct replies to this post
    const replies = await prisma.tweet.findMany({
      where: {
        inReplyToId: postId  // Only get posts that directly reply to this one
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Return the original post and its direct replies
    const thread = [post, ...replies];

    return res.status(200).json({ thread });
  } catch (error) {
    console.error('Error fetching thread:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 