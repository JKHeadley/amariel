import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { MentionStatus } from '@prisma/client';

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
    const mentions = await prisma.mention.findMany({
      where: {
        OR: [
          { status: MentionStatus.PENDING },
          { status: MentionStatus.PROCESSING },
          { status: MentionStatus.FAILED }
        ]
      },
      orderBy: [
        { status: 'asc' },  // Show PENDING first, then PROCESSING, then FAILED
        { createdAt: 'desc' }
      ],
      include: {
        response: true
      }
    });

    return res.status(200).json({ mentions });
  } catch (error) {
    console.error('Error fetching pending mentions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 