import { NextApiRequest, NextApiResponse } from 'next'
import { AmarielService } from '@/services/amariel-service'

const amariel = new AmarielService(
  process.env.OPENAI_API_KEY!,
  {
    apiKey: process.env.X_API_KEY!,
    apiSecret: process.env.X_API_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
    dryRun: true // Always use dry run for chat interface
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
    const { message } = req.body
    const response = await amariel.generateResponse(message)
    res.status(200).json({ response })
  } catch (error) {
    console.error('Error in chat:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
} 