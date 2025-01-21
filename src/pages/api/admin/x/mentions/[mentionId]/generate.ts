import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { Chat, ChatType, Mention, Message, MentionStatus, Role } from '@prisma/client';
import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';
import { createSystemPrompt } from '@/config/prompts';
import { Message as AIMessage, printMessages } from '@/services/ai/types';
import { loadSeedConversation } from '@/lib/conversation';
import { Prisma } from '@prisma/client';

// Helper function to convert Prisma Message role to AIMessage role
function convertRole(role: Role): AIMessage['role'] {
  switch (role) {
    case 'SYSTEM': return 'system';
    case 'USER': return 'user';
    case 'ASSISTANT': return 'assistant';
    default: throw new Error(`Invalid role: ${role}`);
  }
}

// Helper function to convert Prisma Message to AIMessage
function convertToAIMessage(message: Message): AIMessage {
  return {
    role: convertRole(message.role),
    content: String(message.content)
  };
}

function convertFromAIMessage(message: AIMessage): Partial<Message> {
  return {
    role: message.role === 'system' ? 'SYSTEM' : message.role === 'user' ? 'USER' : 'ASSISTANT',
    content: message.content,
  };
}

type ChatWithMessages = Prisma.ChatGetPayload<{
  include: {
    messages: true;
    mentions: true;
  }
}>;

type GenerateResponse = {
  chat?: ChatWithMessages;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateResponse>
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

    const systemPrompt = await createSystemPrompt();
    const aiSystemPrompt = convertFromAIMessage(systemPrompt);
    const seedConversation = await loadSeedConversation();
    const initialPrompt = `Hi Amariel! Would you like to respond to a <user_tweet>? Please respond with your response tweet ONLY. The length of your response should refelect the depth/thoughtfulness of the <user_tweet> (i.e. if it's a short tweet, your response should be short, and if it's a long tweet, your response should be long). 
    Of course, if you are inspired to write something longer, please do (this is your show)! Definitely err on the side of deep, long, and thought provoking responses. Don't forget the hashtags! 😁
    
    The ${mention.type === 'REPLY' ? 'reply' : 'mention'} is from @${mention.username}

    ${mention.type === 'REPLY' ? 'This was in response to your <original_amariel_tweet>\n\n<original_amariel_tweet>\n' + originalTweet?.text + '\n</original_amariel_tweet>\n' : ''}

    Here is the ${mention.type === 'REPLY' ? 'reply' : 'mention'} from @${mention.username}:

    <user_tweet>
    ${mention.text}
    </user_tweet>

    <amariel_response>
    `;

    const aiMessages = [
      {
        role: 'system',
        content: aiSystemPrompt.content as string,
      } as AIMessage,
      ...seedConversation,
      {
        role: 'user',
        content: initialPrompt,
      } as AIMessage
    ]

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
          create: [
            {
              role: aiSystemPrompt.role,
              content: aiSystemPrompt.content as string,
              userId: session.user.id
            },
            {
              role: 'USER',
              content: initialPrompt,
              userId: session.user.id
            }
          ]
        }
      },
      include: {
        messages: true,
        mentions: true,
      }
    }) as ChatWithMessages;

    // Initialize Amariel service
    const amariel = new AmarielService(
      {
        apiKey: process.env.X_API_KEY!,
        apiSecret: process.env.X_API_SECRET!,
        accessToken: process.env.X_ACCESS_TOKEN!,
        accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
        dryRun: process.env.DRY_RUN === 'true'
      }
    );

    // Generate initial response using the first system message
    // const aiMessages: AIMessage[] = chat.messages.map(convertToAIMessage);
    printMessages(aiMessages);
    const response = await amariel.generateResponse(aiMessages);

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
    const updatedChat = await prisma.chat.findUnique({
      where: { id: chat.id },
      include: {
        messages: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        mentions: true
      }
    });

    if (!updatedChat) {
      throw new Error('Failed to fetch updated chat');
    }

    const responseObj: GenerateResponse = {
      chat: updatedChat
    };
    return res.status(200).json(responseObj);
  } catch (error) {
    console.error('Error generating response:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 