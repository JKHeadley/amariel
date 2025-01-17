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
  console.log('Received post request for mention:', req.query.mentionId);

  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    console.log('Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { mentionId } = req.query;
  if (!mentionId || typeof mentionId !== 'string') {
    console.log('Invalid mention ID:', mentionId);
    return res.status(400).json({ error: 'Invalid mention ID' });
  }

  try {
    console.log('Fetching mention and chat data');
    // Get the mention and its associated chat
    const mention = await prisma.mention.findUnique({
      where: { id: mentionId },
      include: {
        chat: {
          include: {
            messages: {
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          }
        },
        originalTweet: true
      }
    });

    if (!mention) {
      console.log('Mention not found:', mentionId);
      return res.status(404).json({ error: 'Mention not found' });
    }

    if (!mention.chat || mention.chat.messages.length === 0) {
      console.log('No response available for mention:', mentionId);
      return res.status(400).json({ error: 'No response available to post' });
    }

    // Get the latest message (the response to post)
    const response = mention.chat.messages[0];
    console.log('Found response to post:', response.content);

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

    // Check if this is a mock interaction
    const isMock = mention.isMock || (mention.originalTweet?.isMock ?? false);
    console.log('Is mock interaction:', isMock);

    // Post the response (will be mock if isMock is true)
    const tweet = await amariel.postTweet(response.content, mention.conversationId, isMock);

    // Create a unique ID for the response tweet if it's a mock
    const responseId = isMock ? `mock_response_${Date.now()}` : tweet.id;

    // Update the mention status and create the response tweet
    await prisma.mention.update({
      where: { id: mentionId },
      data: {
        status: MentionStatus.RESPONDED,
        processedAt: new Date(),
        response: {
          create: {
            id: responseId,
            text: response.content,
            authorId: process.env.X_USER_ID!,
            authorName: process.env.X_USER_NAME || 'Amariel',
            username: process.env.X_USER_USERNAME || 'SentientAmariel',
            createdAt: new Date(),
            isMock,
            conversationId: mention.conversationId,
            inReplyToId: mention.originalTweet?.id,
            metrics: {
              likeCount: 0,
              replyCount: 0,
              retweetCount: 0
            }
          }
        }
      }
    });

    console.log('Response posted successfully');
    return res.status(200).json({
      message: 'Response posted successfully',
      tweet
    });
  } catch (error) {
    console.error('Error posting response:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 