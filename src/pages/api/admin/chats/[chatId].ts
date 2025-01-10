import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { chatId } = req.query;

  if (req.method === 'DELETE') {
    try {
      // First delete all messages associated with the chat
      await prisma.message.deleteMany({
        where: {
          chatId: chatId as string,
        },
      });
      
      // Then delete the chat itself
      await prisma.chat.delete({
        where: {
          id: chatId as string,
        },
      });
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting chat:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { title } = req.body;
      
      const updatedChat = await prisma.chat.update({
        where: {
          id: chatId as string,
        },
        data: {
          title,
        },
      });
      
      return res.status(200).json(updatedChat);
    } catch (error) {
      console.error('Error updating chat:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 