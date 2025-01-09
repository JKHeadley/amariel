import { NextApiRequest, NextApiResponse } from 'next'
import { getOrCreateAdminUser, createChat, getChatHistory } from '@/lib/db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get or create admin user
    const user = await getOrCreateAdminUser()

    // Create new chat
    const chat = await createChat(user.id)

    // Get chat history (empty for new chat)
    const messages = await getChatHistory(chat.id)

    res.status(200).json({ chat, messages })
  } catch (error) {
    console.error('Error initializing chat:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
} 