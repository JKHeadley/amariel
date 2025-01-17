import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { ChatType, MentionStatus } from '@prisma/client';

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

  const mentionId = req.query.mentionId as string;

  try {
    // Get the mention and its thread context
    const mention = await prisma.mention.findUnique({
      where: { id: mentionId },
      include: {
        originalTweet: true,
      }
    });

    if (!mention) {
      return res.status(404).json({ error: 'Mention not found' });
    }

    // Create a new chat for this response
    const chat = await prisma.chat.create({
      data: {
        type: ChatType.X_RESPONSE,
        title: `Response to ${mention.username}`,
        userId: session.user.id,
        mentions: {
          connect: { id: mention.id }
        },
        messages: {
          create: {
            role: 'SYSTEM',
            content: `You are helping to draft a response to a mention on X/Twitter. The mention is from @${mention.username}: "${mention.text}"`,
            userId: session.user.id,
          }
        }
      },
      include: {
        messages: true,
        mentions: true,
      }
    });

    // Update mention status to PROCESSING
    await prisma.mention.update({
      where: { id: mentionId },
      data: {
        status: MentionStatus.PROCESSING,
        processedAt: new Date(),
        chatId: chat.id,
      }
    });

    return res.status(200).json({ chat });
  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 