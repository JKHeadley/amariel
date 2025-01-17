import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { getDataWithCache } from '@/lib/x/cache';
import { fetchMentionsFromX } from '@/lib/x/api';

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
    const mentions = await getDataWithCache({
      type: 'mention',
      fetchFromX: fetchMentionsFromX,
      getFromDb: () => prisma.mention.findMany({
        where: {
          type: 'MENTION'  // Only get mentions, not replies
        },
        include: {
          originalTweet: true,  // The tweet being replied to (for replies)
          response: true      // The response tweet if one exists
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    });

    return res.status(200).json({ mentions });
  } catch (error) {
    console.error('Error fetching mentions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 