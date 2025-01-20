import { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

export const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export async function getOrCreateUser(
  type: 'ADMIN' | 'X_USER',
  identifier: { xId?: string; username: string }
) {
  const user = await prisma.user.upsert({
    where: {
      xId: identifier.xId || identifier.username,
    },
    update: {},
    create: {
      type,
      xId: identifier.xId,
      username: identifier.username,
    },
  })

  return user
}

export async function createChat(userId: string) {
  return prisma.chat.create({
    data: {
      userId,
    },
  })
}

export async function addMessage(
  chatId: string,
  userId: string,
  content: string,
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
) {
  console.log('Adding message:', { chatId, userId, content, role })
  
  try {
    // Verify the chat exists
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    })
    
    if (!chat) {
      console.error(`Chat not found: ${chatId}`)
      throw new Error(`Chat not found: ${chatId}`)
    }

    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })
    
    if (!user) {
      console.error(`User not found: ${userId}`)
      throw new Error(`User not found: ${userId}`)
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        chatId,
        userId,
        content,
        role,
      },
      include: {
        chat: true,
        user: true,
      },
    })

    console.log('Message added successfully:', JSON.stringify(message, null, 2))
    return message
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('Prisma error:', {
        code: error.code,
        message: error.message,
        meta: error.meta,
      })
    }
    console.error('Error adding message:', error)
    throw error
  }
}

export async function getChatHistory(chatId: string) {
  console.log('Getting chat history for:', chatId)
  
  try {
    const messages = await prisma.message.findMany({
      where: {
        chatId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        user: true,
      },
    })

    console.log('Retrieved messages:', messages)
    return messages
  } catch (error) {
    console.error('Error getting chat history:', error)
    throw error
  }
}

export async function getUserChats(userId: string) {
  return prisma.chat.findMany({
    where: {
      userId,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })
}

export async function getOrCreateAdminUser() {
  try {
    const user = await prisma.user.upsert({
      where: {
        xId: 'admin',
      },
      update: {},
      create: {
        type: 'ADMIN',
        xId: 'admin',
        username: 'admin',
      },
      include: {
        chats: true,
      },
    })
    console.log('Admin user:', JSON.stringify(user, null, 2))
    return user
  } catch (error) {
    console.error('Error getting/creating admin user:', error)
    throw error
  }
}

export async function getChatHistoryForOpenAI(chatId: string) {
  const messages = await prisma.message.findMany({
    where: {
      chatId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  return messages.map(msg => ({
    role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
    content: msg.content,
  }))
} 

export async function getAmarielTweets({limit}: {limit?: number}) {
  // fetch the latest <limit> tweets
  return prisma.tweet.findMany({
    where: {
      authorId: process.env.X_USER_ID,
    },
    include: {
      parentTweet: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  })
}