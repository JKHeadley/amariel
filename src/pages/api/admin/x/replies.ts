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

  try {
    // Fetch all replies (tweets with inReplyToId)
    const replies = await prisma.tweet.findMany({
      where: {
        inReplyToId: {
          not: null
        }
      },
      include: {
        parentTweet: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format the replies into threads
    const threads = replies.map(reply => ({
      originalPost: reply.parentTweet,
      reply: {
        id: reply.id,
        text: reply.text,
        authorId: reply.authorId,
        authorName: reply.authorName,
        username: reply.username,
        createdAt: reply.createdAt,
        metrics: reply.metrics,
        isMock: reply.isMock,
        inReplyToId: reply.inReplyToId,
        conversationId: reply.conversationId
      }
    }));

    return res.status(200).json({ threads });
  } catch (error) {
    console.error('Error fetching replies:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 