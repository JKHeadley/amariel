import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const amariel = new AmarielService(
      (process.env.AI_PROVIDER_TYPE as AIProviderType) || 'openai',
      {
        apiKey: process.env.OPENAI_API_KEY!,
        model: process.env.NEXT_PUBLIC_GPT4O_MODEL || 'gpt-4o'
      },
      {
        apiKey: process.env.X_API_KEY!,
        apiSecret: process.env.X_API_SECRET!,
        accessToken: process.env.X_ACCESS_TOKEN!,
        accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
        dryRun: process.env.DRY_RUN === 'true'
      }
    );
    
    await amariel.getPosts();
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error syncing X data:', error);
    return res.status(500).json({ error: 'Failed to sync X data' });
  }
} 