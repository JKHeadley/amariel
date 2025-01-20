import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/db';
import { AmarielService } from '@/services/amariel-service';
import { AIProviderType } from '@/services/ai/provider-factory';

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
    // Get all tweets that need hydration
    const tweets = await prisma.tweet.findMany({
      where: {
        authorId: process.env.X_USER_ID,
        text: {
          contains: '… https://t.co'
        }
      }
    });

    console.log(`Found ${tweets.length} tweets to hydrate`);

    // Initialize Amariel service
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

    // Hydrate tweets in batches of 10 to respect rate limits
    const batchSize = 10;
    const results = [];

    // temporarily only hydrate 3 tweets
    const tweetsToHydrate = tweets
    
    for (let i = 0; i < tweetsToHydrate.length; i += batchSize) {
      const batch = tweetsToHydrate.slice(i, i + batchSize);
      
      // @ts-ignore - xApi is private but we need to access it here
      const hydratedTweets = await amariel.xApi.hydrateTweets(batch.map(t => t.id));
      
      // Update tweets in database
      for (const tweet of hydratedTweets) {
        if (!tweet.note_tweet) {
          console.log(`Tweet ${tweet.id} does not have a note tweet`);
          continue;
        }

        const updated = await prisma.tweet.update({
          where: { id: tweet.id },
          data: { text: tweet.note_tweet.text }
        });
        results.push(updated);
      }

      // Wait a second between batches to respect rate limits
      if (i + batchSize < tweets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return res.status(200).json({ 
      success: true,
      hydrated: results.length,
      tweets: results
    });
  } catch (error) {
    console.error('Error hydrating tweets:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 