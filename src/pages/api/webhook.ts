import { NextApiRequest, NextApiResponse } from 'next';
import { AmarielService } from '@/services/amariel-service';

// Initialize Amariel service
const amariel = new AmarielService(
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
  // Verify X webhook signature
  // TODO: Add signature verification

  if (req.method === 'POST') {
    try {
      const mention = req.body;
      await amariel.handleMention(mention);
      res.status(200).json({ message: 'Processed successfully' });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
} 