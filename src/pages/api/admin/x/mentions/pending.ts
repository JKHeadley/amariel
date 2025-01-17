import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { MentionStatus } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get pending mentions (direct mentions and replies)
    const pendingMentions = await prisma.mention.findMany({
      where: {
        OR: [
          { status: MentionStatus.PENDING },
          { status: MentionStatus.PROCESSING },
          { status: MentionStatus.FAILED }
        ]
      },
      include: {
        originalTweet: true,
        response: true
      }
    });

    // Get unanswered replies to Amariel's posts
    const unansweredReplies = await prisma.tweet.findMany({
      where: {
        AND: [
          { inReplyToId: { not: null } },  // Is a reply
          { 
            parentTweet: {
              authorId: process.env.X_USER_ID  // Parent tweet is by Amariel
            }
          },
          { 
            NOT: {
              mentions: {
                some: {
                  type: 'REPLY',
                  OR: [
                    { status: MentionStatus.RESPONDED },
                    { status: MentionStatus.PROCESSING },
                    { status: MentionStatus.IGNORED }
                  ]
                }
              }
            }
          }
        ]
      },
      include: {
        parentTweet: true
      }
    });

    // Convert unanswered replies to mentions format
    const replyMentions = unansweredReplies.map(reply => ({
      id: `pending_reply_${reply.id}`,
      text: reply.text,
      authorId: reply.authorId,
      authorName: reply.authorName,
      username: reply.username,
      createdAt: reply.createdAt,
      status: MentionStatus.PENDING,
      type: 'REPLY',
      isMock: reply.isMock,
      originalTweet: reply.parentTweet,
      response: null
    }));

    // Combine and sort all pending interactions
    const allPending = [...pendingMentions, ...replyMentions].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    return res.status(200).json({ mentions: allPending });
  } catch (error) {
    console.error('Error fetching pending mentions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 