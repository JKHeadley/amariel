import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { createSystemPrompt } from '@/config/prompts';
import { ChatType } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const chats = await prisma.chat.findMany({
        where: {
          userId: session.user.id,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return res.status(200).json(chats);
    } catch (error) {
      console.error('Error fetching chats:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      // Get system prompt
      const systemPrompt = await createSystemPrompt();

      // Create new chat with system message
      const chat = await prisma.chat.create({
        data: {
          type: ChatType.GENERAL,
          userId: session.user.id,
          messages: {
            create: {
              role: 'SYSTEM',
              content: systemPrompt.content,
              userId: session.user.id,
              type: 'CHAT'
            }
          }
        },
        include: {
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      });

      return res.status(200).json(chat);
    } catch (error) {
      console.error('Error creating chat:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 