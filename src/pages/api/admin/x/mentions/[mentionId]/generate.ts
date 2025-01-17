import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { ChatType, MentionStatus } from '@prisma/client';

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

  try {
    // Check if this is a pending reply (has the prefix we added)
    const isPendingReply = mentionId.startsWith('pending_reply_');
    let mention;
    let originalTweet;

    if (isPendingReply) {
      // Extract the actual tweet ID from the pending_reply_ prefix
      const tweetId = mentionId.replace('pending_reply_', '');
      
      // Get the reply tweet and its parent
      const tweet = await prisma.tweet.findUnique({
        where: { id: tweetId },
        include: { parentTweet: true }
      });

      if (!tweet) {
        return res.status(404).json({ error: 'Reply tweet not found' });
      }

      // Create a mention record for this reply if it doesn't exist
      mention = await prisma.mention.create({
        data: {
          id: mentionId,
          text: tweet.text,
          authorId: tweet.authorId,
          authorName: tweet.authorName,
          username: tweet.username,
          createdAt: tweet.createdAt,
          status: MentionStatus.PROCESSING,
          type: 'REPLY',
          isMock: tweet.isMock,
          originalTweet: {
            connect: { id: tweet.parentTweet!.id }
          }
        },
        include: {
          originalTweet: true,
        }
      });

      originalTweet = tweet.parentTweet;
    } else {
      // Handle regular mention
      mention = await prisma.mention.findUnique({
        where: { id: mentionId },
        include: {
          originalTweet: true,
        }
      });

      if (!mention) {
        return res.status(404).json({ error: 'Mention not found' });
      }

      originalTweet = mention.originalTweet;
    }

    // Create a new chat for this response
    const chat = await prisma.chat.create({
      data: {
        type: ChatType.X_RESPONSE,
        title: `Response to @${mention.username}`,
        userId: session.user.id,
        mentions: {
          connect: { id: mention.id }
        },
        messages: {
          create: {
            role: 'SYSTEM',
            content: `You are helping to draft a response to ${mention.type === 'REPLY' ? 'a reply' : 'a mention'} on X/Twitter. The ${mention.type === 'REPLY' ? 'reply' : 'mention'} is from @${mention.username}: "${mention.text}"${originalTweet ? `\n\nThis was in response to your tweet: "${originalTweet.text}"` : ''}`,
            userId: session.user.id,
          }
        }
      },
      include: {
        messages: true,
        mentions: true,
      }
    });

    // Update mention status to PROCESSING
    await prisma.mention.update({
      where: { id: mention.id },
      data: {
        status: MentionStatus.PROCESSING,
        processedAt: new Date(),
        chatId: chat.id,
      }
    });

    return res.status(200).json({ chat });
  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 