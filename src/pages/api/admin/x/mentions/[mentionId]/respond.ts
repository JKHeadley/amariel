import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';
import { MentionStatus } from '@prisma/client';

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

  const mentionId = req.query.mentionId as string;
  const { response } = req.body;

  try {
    // First mark the mention as processing
    const mention = await prisma.mention.update({
      where: { id: mentionId },
      data: {
        status: MentionStatus.PROCESSING,
        processedAt: new Date(),
        retryCount: {
          increment: 1
        }
      }
    });

    if (!mention) {
      return res.status(404).json({ error: 'Mention not found' });
    }

    try {
      // Create the response tweet
      const tweet = await prisma.tweet.create({
        data: {
          id: `response_${Date.now()}`,
          text: response,
          authorId: process.env.X_USER_ID!,
          createdAt: new Date(),
          isMock: mention.isMock,
          conversationId: mention.conversationId,
          inReplyToId: mention.id,
          metrics: {
            replyCount: 0,
            retweetCount: 0,
            likeCount: 0
          }
        }
      });

      // Update the mention with the response
      await prisma.mention.update({
        where: { id: mentionId },
        data: {
          status: MentionStatus.RESPONDED,
          processed: true,
          processedAt: new Date(),
          responseId: tweet.id
        }
      });

      return res.status(200).json({ tweet });
    } catch (error) {
      // If something goes wrong, mark the mention as failed
      await prisma.mention.update({
        where: { id: mentionId },
        data: {
          status: MentionStatus.FAILED,
          statusReason: error instanceof Error ? error.message : 'Unknown error occurred',
          processedAt: new Date()
        }
      });
      throw error;
    }
  } catch (error) {
    console.error('Error responding to mention:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 