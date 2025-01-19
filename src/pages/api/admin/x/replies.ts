import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getReplies } from '@/lib/x/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const replies = await getReplies();
    
    // Transform the replies into the expected Thread format
    const threads = replies.map(reply => ({
      originalPost: reply.parentTweet,
      reply: reply
    }));

    return res.status(200).json({ threads });
  } catch (error) {
    console.error('Error fetching replies:', error);
    return res.status(500).json({ error: 'Failed to fetch replies' });
  }
} 