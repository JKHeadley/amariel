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
    const { messageId } = req.body;

    // Get the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.type !== 'THOUGHT') {
      return res.status(400).json({ error: 'Message is not a thought' });
    }

    if (message.published) {
      return res.status(400).json({ error: 'Thought already published' });
    }

    // Post to X
    const tweet = await amariel.postTweet(message.content);

    // Update message as published
    await prisma.message.update({
      where: { id: messageId },
      data: { 
        published: true,
        metadata: { tweet: tweet },
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error publishing thought:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 