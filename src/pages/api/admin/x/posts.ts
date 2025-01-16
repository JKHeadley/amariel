import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // First, try to get posts from our database
    const cachedPosts = await prisma.tweet.findMany({
      where: {
        authorId: process.env.X_USER_ID, // Our bot's tweets
        published: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Check if we need to refresh from X API
    const settings = await prisma.systemSettings.findFirst();
    const lastCheck = settings?.lastTweetCheck || new Date(0);
    const shouldRefresh = Date.now() - lastCheck.getTime() > CACHE_DURATION;

    if (shouldRefresh) {
      console.log('🔄 Refreshing posts from X API...');
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
      
      try {
        const posts = await amariel.xApi.getUserTweets();
        
        // Update our cache with new posts
        for (const post of posts) {
          await prisma.tweet.upsert({
            where: { id: post.id },
            update: {
              text: post.text,
              metrics: post.metrics,
              cachedAt: new Date()
            },
            create: {
              id: post.id,
              text: post.text,
              authorId: post.authorId,
              createdAt: new Date(post.createdAt),
              metrics: post.metrics,
              cachedAt: new Date()
            }
          });
        }

        // Update last check timestamp
        await prisma.systemSettings.upsert({
          where: { id: settings?.id || 'default' },
          update: { lastTweetCheck: new Date() },
          create: {
            id: 'default',
            lastTweetCheck: new Date()
          }
        });

        // Return the fresh posts
        return res.status(200).json({ 
          posts,
          fromCache: false
        });
      } catch (error: any) {
        console.error('Error fetching from X API:', error);
        // If we hit rate limits, return cached posts with rate limit headers
        if (error.status === 429) {
          const headers = error.response?.headers;
          res.setHeader('x-rate-limit-limit', headers?.['x-rate-limit-limit'] || '1');
          res.setHeader('x-rate-limit-remaining', '0');
          res.setHeader('x-rate-limit-reset', headers?.['x-rate-limit-reset'] || Math.floor(Date.now() / 1000 + 900)); // Default to 15 minutes
        }
        // Fall back to cached posts
        return res.status(200).json({
          posts: cachedPosts,
          fromCache: true,
          error: error.message
        });
      }
    }

    // Return cached posts if refresh not needed
    return res.status(200).json({
      posts: cachedPosts,
      fromCache: true
    });

  } catch (error) {
    console.error('Error in posts endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 