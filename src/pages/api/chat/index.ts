import { NextApiRequest, NextApiResponse } from 'next'
import { AmarielService } from '@/services/amariel-service'
import { prisma, addMessage, getOrCreateAdminUser } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { AIProviderType } from '@/services/ai/types'

const amariel = new AmarielService(
  process.env.AI_PROVIDER_TYPE as AIProviderType || 'openai',
  {
    apiKey: (() => {
      switch (process.env.AI_PROVIDER_TYPE) {
        case 'xai':
          return process.env.GROK_API_KEY!;
        case 'ollama':
          return 'ollama'; // required but unused
        default:
          return process.env.OPENAI_API_KEY!;
      }
    })(),
    model: (() => {
      switch (process.env.AI_PROVIDER_TYPE) {
        case 'xai':
          return process.env.NEXT_PUBLIC_GROK_MODEL;
        case 'ollama':
          return process.env.NEXT_PUBLIC_OLLAMA_MODEL;
        default:
          return process.env.NEXT_PUBLIC_GPT4O_MODEL;
      }
    })(),
  },
  {
    apiKey: process.env.X_API_KEY!,
    apiSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
    dryRun: process.env.DRY_RUN === 'true'
  }
)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { message, chatId } = req.body
    console.log('Received message:', { message, chatId })

    if (!chatId) {
      throw new Error('chatId is required')
    }

    // Get admin user
    const adminUser = await getOrCreateAdminUser()
    console.log('Admin user:', adminUser)

    // Save user message
    const savedUserMessage = await addMessage(chatId, adminUser.id, message, 'USER')
    console.log('Saved user message:', savedUserMessage)

    // Get chat history for context
    const chatHistory = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: true,
      },
    })
    console.log('Current chat history:', JSON.stringify(chatHistory, null, 2))

    // Generate response with chat history
    const response = await amariel.generateResponse(message, chatId)
    console.log('Generated response:', response)

    // Save assistant message
    const savedAssistantMessage = await addMessage(chatId, adminUser.id, response, 'ASSISTANT')
    console.log('Saved assistant message:', savedAssistantMessage)

    res.status(200).json({ response })
  } catch (error) {
    console.error('Error in chat:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(500).json({ 
        error: 'Database error',
        details: {
          code: error.code,
          message: error.message,
          meta: error.meta,
        }
      })
    }
    res.status(500).json({ error: 'Internal server error', message: error.message })
  }
} 