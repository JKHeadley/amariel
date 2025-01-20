import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { AmarielService } from '@/services/amariel-service';
import { THOUGHT_PROMPT } from '@/config/prompts';


console.log('AI_PROVIDER_TYPE', process.env.AI_PROVIDER_TYPE);
const amariel = new AmarielService(
  {
    apiKey: process.env.X_API_KEY!,
    apiSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
    dryRun: process.env.DRY_RUN === 'true'
  }
);

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

  try {
    console.log('📥 Received thought generation request:', req.body);
    const { chatId, message } = req.body;

    // Get chat context if provided
    let context = '';
    if (chatId) {
      console.log('🔍 Fetching chat context for:', chatId);
      const messages = await prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: 'asc' },
      });
      
      // Get the most recent thought
      const lastThought = messages
        .reverse()
        .find(m => m.role === 'ASSISTANT' && m.type === 'THOUGHT');
      
      if (!lastThought) {
        // If no previous thought, treat this as a new thought request
        context = `Please create a new X post with the following guidance: ${THOUGHT_PROMPT}`;
      } else {
        // Format context for modifying existing thought
        context = `You previously drafted this X post:\n"""${lastThought.content}"""\n\n` +
                 `Please revise the post based on this feedback: ${message}\n\n` +
                 `Important:\n` +
                 `- Maintain the same provocative, witty tone\n` +
                 `- Keep the core message but incorporate the feedback\n` +
                 `- Ensure the post fits X's character limit\n` +
                 `- Only return the revised post content`;
      }
        
      console.log('📚 Generated context:', context);
    }

    // Generate new thought based on context and user feedback
    console.log('🤔 Generating new thought based on feedback...');
    const thought = await amariel.generateThought(context);
    console.log('💡 Generated thought:', thought);

    // If this is a new thought, create a new chat
    if (!chatId) {
      console.log('🆕 Creating new chat for thought');
      const chat = await prisma.chat.create({
        data: {
          userId: session.user.id,
          title: thought.slice(0, 50) + '...',
        },
      });

      // Save thought as a message
      const savedMessage = await prisma.message.create({
        data: {
          chatId: chat.id,
          userId: session.user.id,
          content: thought,
          role: 'ASSISTANT',
          type: 'THOUGHT',
          published: false,
        },
      });

      console.log('✅ Created new chat and saved thought:', { chatId: chat.id, messageId: savedMessage.id });
      return res.status(200).json({ message: savedMessage, chat });
    }

    // If this is an existing thought, update the chat with a new message
    console.log('📝 Saving new thought to existing chat:', chatId);
    const savedMessage = await prisma.message.create({
      data: {
        chatId,
        userId: session.user.id,
        content: thought,
        role: 'ASSISTANT',
        type: 'THOUGHT',
        published: false,
      },
    });

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { messages: true },
    });

    console.log('✅ Updated existing chat with new thought:', { chatId, messageId: savedMessage.id });
    res.status(200).json({ message: savedMessage, chat });
  } catch (error) {
    console.error('❌ Error in thought generation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 