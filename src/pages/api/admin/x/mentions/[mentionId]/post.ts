import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';

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
        }
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

    console.log('Initializing Amariel service');
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

    console.log('Posting response to X');
    // Post the response
    const tweet = await amariel.postTweet(response.content, mention.conversationId, mention.isMock);

    console.log('Updating mention as processed');
    // Update the mention as processed
    await prisma.mention.update({
      where: { id: mentionId },
      data: {
        processed: true,
        response: {
          create: {
            id: `mock_response_${Date.now()}`,
            tweetId: tweet.id,
            text: response.content,
            authorId: 'mock_user',
            createdAt: new Date(),
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