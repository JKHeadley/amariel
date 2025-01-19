import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getMentions } from '@/lib/x/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const mentions = await getMentions();
    return res.status(200).json({ mentions });
  } catch (error) {
    console.error('Error fetching mentions:', error);
    return res.status(500).json({ error: 'Failed to fetch mentions' });
  }
} 