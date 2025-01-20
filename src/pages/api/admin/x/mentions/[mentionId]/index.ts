import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { mentionId } = req.query;
  if (!mentionId || typeof mentionId !== 'string') {
    return res.status(400).json({ error: 'Invalid mention ID' });
  }

  try {
    const mention = await prisma.mention.findUnique({
      where: { id: mentionId },
      include: {
        chat: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              where: { role: 'ASSISTANT', published: false },
              take: 1,
            },
          },
        },
      },
    });

    if (!mention) {
      return res.status(404).json({ error: 'Mention not found' });
    }

    return res.json(mention);
  } catch (error) {
    console.error('Error fetching mention:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 