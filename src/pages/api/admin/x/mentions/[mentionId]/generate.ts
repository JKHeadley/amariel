import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { ChatType, MentionStatus } from '@prisma/client';
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
          id: `mention_${tweet.id}`,
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

    // Initialize Amariel service
    const amariel = new AmarielService(
      (process.env.AI_PROVIDER_TYPE as AIProviderType) || 'openai',
      {
        apiKey: process.env.OPENAI_API_KEY!,
        model: process.env.NEXT_PUBLIC_GPT4O_MODEL || 'gpt-4'
      },
      {
        apiKey: process.env.X_API_KEY!,
        apiSecret: process.env.X_API_SECRET!,
        accessToken: process.env.X_ACCESS_TOKEN!,
        accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
        dryRun: process.env.DRY_RUN === 'true'
      }
    );

    // Generate initial response
    const response = await amariel.generateResponse([{
      role: 'system',
      content: chat.messages[0].content
    }]);

    // Save the AI response
    const aiMessage = await prisma.message.create({
      data: {
        chatId: chat.id,
        role: 'ASSISTANT',
        content: response,
        userId: session.user.id,
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

    // Return both the chat and the generated response
    return res.status(200).json({ 
      chat: {
        ...chat,
        messages: [...chat.messages, aiMessage]
      } 
    });
  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 