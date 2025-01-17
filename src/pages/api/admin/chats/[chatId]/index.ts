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
  console.log('Received request for chat:', req.query.chatId, 'Method:', req.method);

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    console.log('Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { chatId } = req.query;
  if (!chatId || typeof chatId !== 'string') {
    console.log('Invalid chat ID:', chatId);
    return res.status(400).json({ error: 'Invalid chat ID' });
  }

  if (req.method === 'GET') {
    try {
      console.log('Fetching chat data');
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          },
          mentions: {
            include: {
              originalTweet: true,
              response: true
            }
          }
        }
      });

      if (!chat) {
        console.log('Chat not found:', chatId);
        return res.status(404).json({ error: 'Chat not found' });
      }

      // Initialize Amariel service to generate initial response if none exists
      if (chat.messages.length === 1) { // Only SYSTEM message exists
        console.log('Generating initial response');
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

        const response = await amariel.generateResponse(chat.messages);
        
        // Save the response
        const newMessage = await prisma.message.create({
          data: {
            chatId: chat.id,
            role: 'ASSISTANT',
            content: response,
            userId: session.user.id,
            type: 'CHAT'
          }
        });

        chat.messages.push(newMessage);
      }

      // Get thread context
      let threadContext = [];
      const mention = chat.mentions[0];
      if (mention?.originalTweet) {
        // If this is a reply, get the original tweet and any parent tweets
        let currentTweet = mention.originalTweet;
        const tweets = [currentTweet];
        
        // Follow the chain of parent tweets
        while (currentTweet.inReplyToId) {
          const parentTweet = await prisma.tweet.findUnique({
            where: { id: currentTweet.inReplyToId }
          });
          if (parentTweet) {
            tweets.unshift(parentTweet);
            currentTweet = parentTweet;
          } else {
            break;
          }
        }
        
        threadContext = tweets;
      }

      console.log('Successfully fetched chat data');
      return res.status(200).json({
        ...chat,
        threadContext
      });
    } catch (error) {
      console.error('Error fetching chat:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 