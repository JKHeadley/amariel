import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { mentionId } = req.query;
  if (!mentionId || typeof mentionId !== 'string') {
    return res.status(400).json({ error: 'Invalid mention ID' });
  }

  try {
    // Get the chat ID associated with this mention
    const mention = await prisma.mention.findUnique({
      where: { id: mentionId },
      select: { chatId: true }
    });

    if (!mention) {
      return res.status(404).json({ error: 'Mention not found' });
    }

    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // Delete the chat and its messages if it exists
      if (mention.chatId) {
        await tx.message.deleteMany({
          where: { chatId: mention.chatId }
        });
        await tx.chat.delete({
          where: { id: mention.chatId }
        });
      }

      // Reset the mention status
      await tx.mention.update({
        where: { id: mentionId },
        data: {
          status: 'PENDING',
          processedAt: null,
          chatId: null
        }
      });
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error resetting mention:', error);
    return res.status(500).json({ error: 'Failed to reset mention' });
  }
} 