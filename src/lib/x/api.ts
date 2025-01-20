import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';
import { prisma } from '@/lib/db';
import { Tweet, Mention } from '@prisma/client';

// Fetch and store tweets from X API - this should be called periodically
export async function fetchTweetsFromX() {
  console.log('🔍 Fetching tweets from X');
  const amariel = getAmarielService();
  try {
    // @ts-ignore - xApi is private but we need to access it here
    return amariel.xApi.getUserTweets();
  } catch (error) {
    return handleXAPIError(error, async () => {
      return prisma.tweet.findMany({
        orderBy: { createdAt: 'desc' }
      });
    });
  }
}

// Database query functions for UI
export async function getPosts() {
  return prisma.tweet.findMany({
    where: {
      authorId: process.env.X_USER_ID,
      inReplyToId: null // Not a reply
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getReplies() {
  return prisma.tweet.findMany({
    where: {
      authorId: process.env.X_USER_ID,
      inReplyToId: { not: null }
    },
    include: {
      parentTweet: true // Include the original tweet through the parentTweet relation
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getMentions() {
  return prisma.mention.findMany({
    where: {
      processedAt: { not: null },
      status: { not: 'IGNORED' }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getPendingMentions() {
  return prisma.mention.findMany({
    where: {
      OR: [
        { status: 'PENDING' },
        { status: 'PROCESSING' }
      ],
      NOT: { status: 'IGNORED' }
    },
    include: {
      chat: {
        include: {
          messages: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1,
            where: {
              role: 'ASSISTANT'
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

// Helper functions
function getAmarielService() {
  return new AmarielService(
    (process.env.AI_PROVIDER_TYPE as AIProviderType) || 'openai',
    {
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.NEXT_PUBLIC_GPT4O_MODEL || 'gpt-4o'
    },
    {
      apiKey: process.env.X_API_KEY!,
      apiSecret: process.env.X_API_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
      dryRun: process.env.DRY_RUN === 'true'
    }
  );
}

async function handleXAPIError(error: any, fallbackFn: () => Promise<any>) {
  if (error.status === 429 || (error.response && error.response.status === 429)) {
    console.warn('X API rate limit reached, falling back to database');
    return await fallbackFn();
  }
  throw error;
}