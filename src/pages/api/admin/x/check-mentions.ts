import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get system settings
    const settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      return res.status(500).json({ error: 'System settings not found' });
    }

    // Check mentions
    const mentions = await amariel.checkAndRespondToMentions();

    // Update last check time
    await prisma.systemSettings.update({
      where: { id: settings.id },
      data: {
        lastMentionCheck: new Date(),
        lastMentionId: mentions.meta?.newest_id,
      },
    });

    return res.status(200).json({
      success: true,
      mentions,
      mode: settings.xAutomationMode,
    });
  } catch (error) {
    console.error('Error checking mentions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 