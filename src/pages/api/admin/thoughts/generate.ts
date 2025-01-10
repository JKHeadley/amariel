import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/types';

const amariel = new AmarielService(
  process.env.AI_PROVIDER_TYPE as AIProviderType || 'openai',
  {
    apiKey: (() => {
      switch (process.env.AI_PROVIDER_TYPE) {
        case 'xai':
          return process.env.GROK_API_KEY!;
        case 'ollama':
          return 'ollama';
        default:
          return process.env.OPENAI_API_KEY!;
      }
    })(),
    model: (() => {
      switch (process.env.AI_PROVIDER_TYPE) {
        case 'xai':
          return process.env.NEXT_PUBLIC_GROK_MODEL;
        case 'ollama':
          return process.env.NEXT_PUBLIC_OLLAMA_MODEL;
        default:
          return process.env.NEXT_PUBLIC_GPT4O_MODEL;
      }
    })(),
  },
  {
    apiKey: process.env.X_API_KEY!,
    apiSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
    dryRun: process.env.DRY_RUN === 'true'
  }
);

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

  try {
    const { chatId } = req.body;

    // Get chat context if provided
    let context = '';
    if (chatId) {
      const messages = await prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
      });
      
      context = messages
        .map(m => `${m.role === 'USER' ? 'User' : 'Amariel'}: ${m.content}`)
        .join('\n');
    }

    // Generate thought
    const thought = await amariel.generateThought(context);

    // Create a new chat for this thought
    const chat = await prisma.chat.create({
      data: {
        userId: session.user.id,
        title: thought.slice(0, 50) + '...',
        parentId: chatId, // This will need schema update
      },
    });

    // Save thought as a message
    const savedMessage = await prisma.message.create({
      data: {
        chatId: chat.id,
        userId: session.user.id,
        content: thought,
        role: 'ASSISTANT',
        type: 'THOUGHT',
        published: false,
      },
    });

    res.status(200).json({ message: savedMessage, chat });
  } catch (error) {
    console.error('Error generating thought:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 