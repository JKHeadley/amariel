import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';
import { prisma } from '@/lib/db';
import { Tweet, Mention } from '@prisma/client';


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