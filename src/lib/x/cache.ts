import { prisma } from '@/lib/db';
import { differenceInMinutes } from 'date-fns';

const CACHE_DURATION_MINUTES = 15;

export async function getDataWithCache<T>({
  type,
  fetchFromX,
  getFromDb,
}: {
  type: 'tweet' | 'mention';
  fetchFromX: () => Promise<T[]>;
  getFromDb: () => Promise<T[]>;
}) {
  const settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    throw new Error('System settings not found');
  }

  const lastCheck = type === 'tweet' ? settings.lastTweetCheck : settings.lastMentionCheck;
  const shouldRefresh = !lastCheck || differenceInMinutes(new Date(), lastCheck) >= CACHE_DURATION_MINUTES;

  if (shouldRefresh) {
    try {
      console.log(`🔄 Refreshing ${type}s from X API...`);
      const xData = await fetchFromX();
      console.log(`✅ Cached ${xData.length} ${type}s from X API`);

      // Update the last check timestamp
      await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          ...(type === 'tweet' 
            ? { lastTweetCheck: new Date() }
            : { lastMentionCheck: new Date() }
          )
        }
      });
    } catch (error) {
      console.error(`Error fetching from X API:`, error);
      // Continue with existing data if fetch fails
    }
  }

  // Return all data from DB (both X and mock data)
  return getFromDb();
} 