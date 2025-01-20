import { prisma } from '@/lib/db';
import { AmarielService } from './amariel-service';
import { AIProviderType } from './ai/provider-factory';
import { SystemSettings, SyncStatus } from '@prisma/client';
import { XDataProcessor } from '@/lib/x/data-processor';

export class SyncService {
  private amariel: AmarielService;
  private dataProcessor: XDataProcessor;
  
  constructor() {
    this.amariel = new AmarielService(
      {
        apiKey: process.env.X_API_KEY!,
        apiSecret: process.env.X_API_SECRET!,
        accessToken: process.env.X_ACCESS_TOKEN!,
        accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET!,
        dryRun: process.env.DRY_RUN === 'true'
      }
    );
    this.dataProcessor = new XDataProcessor(process.env.X_USER_ID!);
  }

  async sync(forceFullSync = false) {
    console.log('🔄 Starting sync...', forceFullSync ? '(full sync)' : '(incremental sync)');
    
    try {
      // Get or create system settings
      const settings = await this.getOrCreateSettings();
      
      // Check if sync is already in progress
      if (settings.syncStatus === SyncStatus.IN_PROGRESS) {
        console.warn('⚠️ Sync already in progress');
        return;
      }
      
      // Update sync status
      await this.updateSyncStatus(SyncStatus.IN_PROGRESS);
      
      // Get sync parameters
      const params = await this.getSyncParameters(forceFullSync);
      
      // Fetch new data from X API
      const [tweets, mentions] = await Promise.all([
        // @ts-ignore - xApi is private but we need to access it here
        this.amariel.xApi.fetchTweetsFromAPI(process.env.X_USER_ID!, params),
        // @ts-ignore - xApi is private but we need to access it here
        this.amariel.xApi.fetchMentionsFromAPI(params)
      ]);
      
      // Process the data
      const processedTweets = await this.dataProcessor.processTweets(tweets);
      await this.dataProcessor.processMentions(mentions, tweets.filter(t => t.author_id === process.env.X_USER_ID));
      
      // Update sync status and timestamps
      await this.updateSyncStatus(SyncStatus.COMPLETED, {
        lastTweetId: processedTweets[0]?.id,
        lastMentionId: mentions[0]?.id
      });
      
      console.log('✅ Sync completed successfully');
    } catch (error: any) {
      console.error('❌ Sync failed:', error);
      await this.updateSyncStatus(SyncStatus.FAILED, { error: error.message });
      throw error;
    }
  }

  private async getOrCreateSettings(): Promise<SystemSettings> {
    const settings = await prisma.systemSettings.findFirst();
    if (settings) return settings;
    
    return prisma.systemSettings.create({
      data: {
        syncStatus: SyncStatus.IDLE
      }
    });
  }

  private async updateSyncStatus(
    status: SyncStatus,
    data: { lastTweetId?: string; lastMentionId?: string; error?: string } = {}
  ) {
    return prisma.systemSettings.updateMany({
      data: {
        syncStatus: status,
        ...(status === SyncStatus.COMPLETED && {
          lastSyncAt: new Date(),
          lastTweetId: data.lastTweetId,
          lastMentionId: data.lastMentionId,
          syncError: null
        }),
        ...(status === SyncStatus.FAILED && {
          syncError: data.error
        })
      }
    });
  }

  private async getSyncParameters(forceFullSync: boolean) {
    if (forceFullSync) {
      return { since_id: undefined };
    }
    
    const settings = await this.getOrCreateSettings();
    return {
      since_id: settings.lastTweetId
    };
  }
} 