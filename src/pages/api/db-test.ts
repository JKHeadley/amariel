import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/db'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Test database connection
    const result = await prisma.$queryRaw`SELECT NOW()`
    console.log('Database connection test:', result)

    // Count users
    const userCount = await prisma.user.count()
    console.log('User count:', userCount)

    res.status(200).json({ status: 'Database connection successful', userCount })
  } catch (error) {
    console.error('Database connection error:', error)
    res.status(500).json({ error: 'Database connection failed', details: error.message })
  }
} 