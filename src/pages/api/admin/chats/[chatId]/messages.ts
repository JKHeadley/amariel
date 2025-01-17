import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Received message request for chat:', req.query.chatId);

  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    console.log('Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { chatId } = req.query;
  if (!chatId || typeof chatId !== 'string') {
    console.log('Invalid chat ID:', chatId);
    return res.status(400).json({ error: 'Invalid chat ID' });
  }

  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    console.log('Invalid message content:', content);
    return res.status(400).json({ error: 'Invalid message content' });
  }

  try {
    console.log('Fetching chat with ID:', chatId);
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
      console.log('Chat not found:', chatId);
      return res.status(404).json({ error: 'Chat not found' });
    }

    console.log('Creating user message');
    // Add the user's message
    const userMessage = await prisma.message.create({
      data: {
        chatId,
        userId: session.user.id,
        role: 'USER',
        content
      }
    });

    console.log('Initializing Amariel service');
    // Initialize Amariel service
    const amariel = new AmarielService(
      (process.env.AI_PROVIDER_TYPE as AIProviderType) || 'openai',
      {
        apiKey: process.env.OPENAI_API_KEY!,
        model: process.env.NEXT_PUBLIC_GPT4O_MODEL || 'gpt-4'
      },
      {
        apiKey: process.env.X_API_KEY!,
        apiSecret: process.env.X_API_SECRET!,
        accessToken: process.env.X_ACCESS_TOKEN!,
        accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
        dryRun: process.env.DRY_RUN === 'true'
      }
    );

    console.log('Preparing messages for AI');
    // Get AI response
    const messages = chat.messages.map(msg => ({
      role: msg.role.toLowerCase(),
      content: msg.content
    }));
    messages.push({
      role: 'user',
      content
    });

    console.log('Getting AI response');
    const aiResponse = await amariel.generateResponse(messages);

    console.log('Saving AI response');
    // Save AI response
    const assistantMessage = await prisma.message.create({
      data: {
        chatId,
        userId: session.user.id,
        role: 'ASSISTANT',
        content: aiResponse
      }
    });

    console.log('Returning assistant message');
    return res.status(200).json({
      message: assistantMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 