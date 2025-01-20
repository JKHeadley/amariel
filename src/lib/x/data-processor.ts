import { prisma } from '@/lib/db';
import { Tweet, Mention, MentionStatus, InteractionType } from '@prisma/client';

interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

interface ReferencedTweet {
  type: 'replied_to' | 'quoted' | 'retweeted';
  id: string;
  text?: string;
  author_id?: string;
  author?: TwitterUser;
  created_at?: string;
  public_metrics?: {
    reply_count: number;
    retweet_count: number;
    like_count: number;
  };
}

interface TwitterAPITweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  conversation_id?: string;
  referenced_tweets?: ReferencedTweet[];
  public_metrics?: {
    reply_count: number;
    retweet_count: number;
    like_count: number;
  };
  author?: TwitterUser;
}

interface ProcessedData {
  tweets: Tweet[];
  mentions: Mention[];
}

type ConversationMap = Map<string, TwitterAPITweet[]>;

export class XDataProcessor {
  constructor(private userId: string) {}

  /**
   * Process all tweets and mentions from the X API
   * This is the main entry point that handles the complete flow
   */
  async processXData(tweets: TwitterAPITweet[], mentions: TwitterAPITweet[]): Promise<ProcessedData> {
    console.log('🔄 Starting X data processing...');
    
    // 1. Combine all tweets and mentions
    const allTweets = [...tweets, ...mentions];
    console.log(`📊 Processing ${allTweets.length} total tweets`);

    // 2. Group by conversation and sort each group
    const conversationMap = this.groupByConversation(allTweets);
    this.sortConversations(conversationMap);
    
    // 3. Process each conversation in order
    const processedData = await this.processConversations(conversationMap);
    
    console.log('✅ Finished processing X data:', {
      tweets: processedData.tweets.length,
      mentions: processedData.mentions.length
    });
    
    return processedData;
  }

  private groupByConversation(tweets: TwitterAPITweet[]): ConversationMap {
    const conversationMap: ConversationMap = new Map();
    
    for (const tweet of tweets) {
      // Use either conversation_id or tweet's own id as the conversation id
      const conversationId = tweet.conversation_id || tweet.id;
      
      if (!conversationMap.has(conversationId)) {
        conversationMap.set(conversationId, []);
      }
      
      conversationMap.get(conversationId)!.push(tweet);
    }
    
    return conversationMap;
  }

  private sortConversations(conversationMap: ConversationMap): void {
    for (const [_, tweets] of Array.from(conversationMap.entries())) {
      tweets.sort((a: TwitterAPITweet, b: TwitterAPITweet) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
  }

  private async processConversations(conversationMap: ConversationMap): Promise<ProcessedData> {
    const processedTweets: Tweet[] = [];
    const processedMentions: Mention[] = [];
    const existingTweetIds = new Set<string>();

    // Process each conversation
    for (const [conversationId, tweets] of Array.from(conversationMap.entries())) {
      console.log(`🧵 Processing conversation ${conversationId} with ${tweets.length} tweets`);
      
      // First ensure all referenced tweets exist
      await this.createMissingReferencedTweets(tweets, existingTweetIds);
      
      // Process each tweet in the conversation
      for (const tweet of tweets) {
        const isAmarielTweet = tweet.author_id === this.userId;
        
        // Create or update the tweet
        const dbTweet = await this.processTweet(tweet);
        existingTweetIds.add(dbTweet.id);
        processedTweets.push(dbTweet);
        
        // If this is a mention/reply to Amariel, create or update the mention record
        if (!isAmarielTweet && (
          tweet.text.includes('@SentientAmariel') || 
          tweet.referenced_tweets?.some(ref => 
            ref.type === 'replied_to' && 
            tweets.some(t => t.id === ref.id && t.author_id === this.userId)
          )
        )) {
          const dbMention = await this.processMention(tweet, tweets);
          processedMentions.push(dbMention);
        }
      }
    }

    return { tweets: processedTweets, mentions: processedMentions };
  }

  private async createMissingReferencedTweets(
    tweets: TwitterAPITweet[], 
    existingTweetIds: Set<string>
  ): Promise<void> {
    const referencedTweetIds = new Set(
      tweets
        .flatMap(t => t.referenced_tweets || [])
        .filter(ref => ref.type === 'replied_to')
        .map(ref => ref.id)
    );

    for (const id of Array.from(referencedTweetIds)) {
      if (!existingTweetIds.has(id)) {
        const referencedTweet = tweets
          .flatMap(t => t.referenced_tweets || [])
          .find(ref => ref.id === id);
          
        if (referencedTweet) {
          const dbTweet = await this.createPlaceholderTweet(referencedTweet);
          existingTweetIds.add(dbTweet.id);
        }
      }
    }
  }

  private async processTweet(tweet: TwitterAPITweet): Promise<Tweet> {
    const isAmarielTweet = tweet.author_id === this.userId;
    const referencedTweet = tweet.referenced_tweets?.find(ref => ref.type === 'replied_to');

    return prisma.tweet.upsert({
      where: { id: tweet.id },
      update: {
        text: tweet.text,
        authorId: tweet.author_id,
        authorName: tweet.author?.name || (isAmarielTweet ? process.env.X_AUTHOR_NAME : 'Unknown User'),
        username: tweet.author?.username || (isAmarielTweet ? process.env.X_USERNAME : 'unknown'),
        metrics: {
          replyCount: tweet.public_metrics?.reply_count ?? 0,
          retweetCount: tweet.public_metrics?.retweet_count ?? 0,
          likeCount: tweet.public_metrics?.like_count ?? 0
        },
        cachedAt: new Date()
      },
      create: {
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id,
        authorName: tweet.author?.name || (isAmarielTweet ? process.env.X_AUTHOR_NAME : 'Unknown User'),
        username: tweet.author?.username || (isAmarielTweet ? process.env.X_USERNAME : 'unknown'),
        createdAt: new Date(tweet.created_at),
        cachedAt: new Date(),
        conversationId: tweet.conversation_id || null,
        inReplyToId: referencedTweet?.id || null,
        metrics: {
          replyCount: tweet.public_metrics?.reply_count ?? 0,
          retweetCount: tweet.public_metrics?.retweet_count ?? 0,
          likeCount: tweet.public_metrics?.like_count ?? 0
        },
        published: true,
        isMock: false
      }
    });
  }

  private async createPlaceholderTweet(tweet: ReferencedTweet): Promise<Tweet> {
    return prisma.tweet.upsert({
      where: { id: tweet.id },
      update: {
        text: tweet.text || '[Original tweet not cached]',
        authorId: tweet.author_id || 'unknown',
        authorName: tweet.author?.name || 'Unknown User',
        username: tweet.author?.username || 'unknown',
        metrics: tweet.public_metrics ? {
          replyCount: tweet.public_metrics.reply_count ?? 0,
          retweetCount: tweet.public_metrics.retweet_count ?? 0,
          likeCount: tweet.public_metrics.like_count ?? 0
        } : {
          replyCount: 0,
          retweetCount: 0,
          likeCount: 0
        }
      },
      create: {
        id: tweet.id,
        text: tweet.text || '[Original tweet not cached]',
        authorId: tweet.author_id || 'unknown',
        authorName: tweet.author?.name || 'Unknown User',
        username: tweet.author?.username || 'unknown',
        createdAt: new Date(tweet.created_at || Date.now()),
        cachedAt: new Date(),
        metrics: tweet.public_metrics ? {
          replyCount: tweet.public_metrics.reply_count ?? 0,
          retweetCount: tweet.public_metrics.retweet_count ?? 0,
          likeCount: tweet.public_metrics.like_count ?? 0
        } : {
          replyCount: 0,
          retweetCount: 0,
          likeCount: 0
        },
        published: true,
        isMock: false
      }
    });
  }

  private async processMention(mention: TwitterAPITweet, conversationTweets: TwitterAPITweet[]): Promise<Mention> {
    const referencedTweet = mention.referenced_tweets?.find(ref => ref.type === 'replied_to');
    
    // Check if Amariel has responded to this mention
    const hasResponse = conversationTweets.some(t => 
      t.author_id === this.userId && 
      t.referenced_tweets?.some(ref => ref.type === 'replied_to' && ref.id === mention.id)
    );
    
    return prisma.mention.upsert({
      where: { id: mention.id },
      update: {
        text: mention.text,
        authorId: mention.author_id,
        authorName: mention.author?.name || 'Unknown User',
        username: mention.author?.username || 'unknown',
        status: hasResponse ? MentionStatus.RESPONDED : MentionStatus.PENDING,
        type: referencedTweet ? InteractionType.REPLY : InteractionType.MENTION,
        inReplyToId: referencedTweet?.id,
        cachedAt: new Date()
      },
      create: {
        id: mention.id,
        text: mention.text,
        authorId: mention.author_id,
        authorName: mention.author?.name || 'Unknown User',
        username: mention.author?.username || 'unknown',
        createdAt: new Date(mention.created_at),
        cachedAt: new Date(),
        status: hasResponse ? MentionStatus.RESPONDED : MentionStatus.PENDING,
        type: referencedTweet ? InteractionType.REPLY : InteractionType.MENTION,
        inReplyToId: referencedTweet?.id
      }
    });
  }
} 