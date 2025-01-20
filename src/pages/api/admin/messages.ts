import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { AmarielService } from '@/services/amariel-service';
import { createSystemPrompt } from '@/config/prompts';
import { loadSeedConversation } from '@/lib/conversation';
import { Message as AIMessage } from '@/services/ai/types';

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

  const { content, chatId } = req.body;
  if (!content || !chatId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get the chat and its messages
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Create user message
    const userMessage = await prisma.message.create({
      data: {
        chatId,
        userId: session.user.id,
        role: 'USER',
        content,
        type: 'CHAT'
      }
    });

    // Initialize Amariel service
    const amariel = new AmarielService({
      apiKey: process.env.X_API_KEY!,
      apiSecret: process.env.X_API_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
      dryRun: process.env.DRY_RUN === 'true'
    });

    // Get system prompt and seed conversation
    const systemPrompt = await createSystemPrompt();
    const seedConversation = loadSeedConversation();

    // Prepare messages for AI
    const aiMessages: AIMessage[] = [
      systemPrompt,
      ...seedConversation,
      ...chat.messages.map(msg => ({
        role: msg.role.toLowerCase() as 'system' | 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content
      }
    ];

    // Get AI response
    const aiResponse = await amariel.generateResponse(aiMessages);

    // Save AI response
    const assistantMessage = await prisma.message.create({
      data: {
        chatId,
        userId: session.user.id,
        role: 'ASSISTANT',
        content: aiResponse,
        type: 'CHAT'
      }
    });

    // Update chat with both messages
    const updatedChat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    return res.status(200).json({
      message: assistantMessage,
      chat: updatedChat
    });
  } catch (error) {
    console.error('Error handling message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 