import { NextApiRequest, NextApiResponse } from 'next';
import { AmarielService } from '@/services/amariel-service';

const amariel = new AmarielService(
  process.env.OPENAI_API_KEY!,
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
  if (req.method === 'POST') {
    try {
      await amariel.shareThought();
      res.status(200).json({ message: 'Thought shared successfully' });
    } catch (error) {
      console.error('Error sharing thought:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 