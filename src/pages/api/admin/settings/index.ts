import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { XAutomationMode } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      console.log('🔍 Fetching system settings');
      // Get or create system settings
      let settings = await prisma.systemSettings.findFirst();
      
      if (!settings) {
        console.log('📝 Creating default system settings');
        settings = await prisma.systemSettings.create({
          data: {
            xAutomationMode: 'SEMI_AUTOMATIC',
          },
        });
      }

      console.log('✅ Returning settings:', settings);
      return res.status(200).json(settings);
    } catch (error) {
      console.error('❌ Error fetching settings:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      console.log('🔄 Updating system settings:', req.body);
      const { xAutomationMode } = req.body;

      // Validate automation mode
      if (!Object.values(XAutomationMode).includes(xAutomationMode)) {
        console.error('❌ Invalid automation mode:', xAutomationMode);
        return res.status(400).json({ error: 'Invalid automation mode' });
      }

      // Update or create settings
      const settings = await prisma.systemSettings.upsert({
        where: {
          // Get the first record since we only have one settings record
          id: (await prisma.systemSettings.findFirst())?.id || 'default',
        },
        update: {
          xAutomationMode,
        },
        create: {
          xAutomationMode,
        },
      });

      console.log('✅ Settings updated:', settings);
      return res.status(200).json(settings);
    } catch (error) {
      console.error('❌ Error updating settings:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 