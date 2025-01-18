import crypto from 'crypto';
import { XConfig } from './types';
import { prisma } from '@/lib/db';
import { Prisma, PrismaClient, Tweet as PrismaTweet, Mention } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

interface TwitterAPITweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  conversation_id?: string;
  referenced_tweets?: Array<{
    type: 'replied_to' | 'quoted' | 'retweeted';
    id: string;
  }>;
  public_metrics?: {
    reply_count: number;
    retweet_count: number;
    like_count: number;
  };
  author?: TwitterUser;
}

interface TwitterResponse {
  data: TwitterAPITweet[];
  includes?: {
    users?: TwitterUser[];
    tweets?: TwitterAPITweet[];
  };
  meta?: {
    result_count: number;
    newest_id: string;
    oldest_id: string;
    next_token?: string;
  };
}

interface TweetThread {
  conversationId: string;
  tweets: TwitterAPITweet[];
}

interface ProcessedThread {
  tweets: PrismaTweet[];
  mentions: Mention[];
}

type ConversationMap = Map<string, TwitterAPITweet[]>;

export class XAPIService {
  private config: XConfig;
  private devMode: boolean;

  constructor(config: XConfig) {
    this.config = config;
    this.devMode = process.env.NEXT_PUBLIC_X_API_DEV_MODE === 'true';
  }

  private async makeAuthenticatedRequest(
    url: string,
    method: string,
    queryParams?: URLSearchParams,
    body?: Record<string, any>
  ) {
    const paramsObject = queryParams ? Object.fromEntries(queryParams.entries()) : undefined;
    const oauthParams = this.generateOAuthParams(method, url, paramsObject, body);
    const headers = {
      'Authorization': `OAuth ${this.formatOAuthHeaders(oauthParams)}`,
      'Content-Type': 'application/json',
    };

    const finalUrl = queryParams ? `${url}?${queryParams.toString()}` : url;

    console.log('🔑 OAuth Params:', oauthParams);
    console.log('🔑 Headers:', headers);
    console.log('🔑 Final URL:', finalUrl);

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    return fetch(finalUrl, requestOptions);
  }

  private generateOAuthParams(
    method: string,
    url: string,
    queryParams?: Record<string, string>,
    body?: Record<string, any>
  ): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.config.apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: this.config.accessToken,
      oauth_version: '1.0'
    };

    const params = {
      ...queryParams,
      ...oauthParams,
      ...(body || {})
    };

    const signatureBaseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(
        Object.keys(params)
          .sort()
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
          .join('&')
      )
    ].join('&');

    console.log('🔑 Signature Base String:', signatureBaseString);

    const signingKey = `${encodeURIComponent(this.config.apiSecret)}&${encodeURIComponent(this.config.accessTokenSecret)}`;
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    return {
      ...oauthParams,
      oauth_signature: signature
    };
  }

  private formatOAuthHeaders(params: Record<string, string>): string {
    return Object.keys(params)
      .sort()
      .map(key => `${key}="${encodeURIComponent(params[key])}"`)
      .join(', ');
  }

  private async loadMockData(type: 'tweets' | 'mentions'): Promise<TwitterResponse> {
    try {
      const filePath = path.join(process.cwd(), 'data', 
        type === 'tweets' ? 'amariel_tweets_example_response.json' : 'amariel_mentions_example_response.json'
      );
      
      const fileContents = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContents);
    } catch (error) {
      console.error(`Failed to load mock ${type} data:`, error);
      return { 
        data: [], 
        includes: { users: [] }, 
        meta: { 
          result_count: 0,
          newest_id: '0',
          oldest_id: '0'
        } 
      };
    }
  }

  private async fetchTweetsFromAPI(userId: string): Promise<TwitterAPITweet[]> {
    if (this.devMode) {
      console.log('🎭 Using mock tweets data');
      const mockData = await this.loadMockData('tweets');
      return this.processTweetsResponse(mockData);
    }

    if (!userId) {
      throw new Error('User ID is required to fetch tweets');
    }

    console.log('🔍 Fetching tweets for user:', userId);
    const allTweets: TwitterAPITweet[] = [];
    let nextToken: string | undefined;
    
    do {
      const url = `https://api.twitter.com/2/users/${userId}/tweets`;
      const params = new URLSearchParams({
        'tweet.fields': 'created_at,public_metrics,referenced_tweets,conversation_id,in_reply_to_user_id,author_id',
        'expansions': 'author_id,referenced_tweets.id,referenced_tweets.id.author_id,in_reply_to_user_id',
        'user.fields': 'id,name,username',
        'max_results': '100',
        ...(nextToken && { 'pagination_token': nextToken })
      });

      console.log('📡 Making API request:', url);
      console.log('📝 Request params:', Object.fromEntries(params.entries()));
      
      const response = await this.makeAuthenticatedRequest(url, 'GET', params);

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ API request failed:', {
          status: response.status,
          error,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw {
          status: response.status,
          response,
          message: error.detail || 'Failed to fetch tweets'
        };
      }

      const data = await response.json() as TwitterResponse;
      console.log('📥 Raw API response:', JSON.stringify(data, null, 2));
      
      const processedTweets = this.processTweetsResponse(data);
      allTweets.push(...processedTweets);
      
      nextToken = data.meta?.next_token;

      if (nextToken) {
        console.log('⏳ Waiting for rate limit (1s) before next request...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } while (nextToken);

    console.log(`📊 Total tweets fetched: ${allTweets.length}`);
    return allTweets;
  }

  private processTweetsResponse(data: TwitterResponse): TwitterAPITweet[] {
    if (!data.data) {
      console.warn('⚠️ No tweet data in response');
      return [];
    }

    // Process includes data
    const includes = data.includes || {};
    const users = includes.users || [];
    const referencedTweets = includes.tweets || [];

    console.log('📊 Processing response with:', {
      tweets: data.data.length,
      users: users.length,
      referencedTweets: referencedTweets.length
    });

    // Merge includes data into each tweet
    return data.data.map(tweet => {
      // Find the author from the users array
      const author = users.find((user: TwitterUser) => user.id === tweet.author_id);
      if (!author) {
        console.warn(`⚠️ No author found for tweet ${tweet.id} (author_id: ${tweet.author_id})`);
      } else {
        console.log(`✅ Found author for tweet ${tweet.id}:`, author);
      }
      
      // Process referenced tweets
      const processedReferencedTweets = tweet.referenced_tweets?.map(ref => {
        const referencedTweet = referencedTweets.find(t => t.id === ref.id);
        if (!referencedTweet) {
          console.warn(`⚠️ Referenced tweet ${ref.id} not found in includes`);
          return ref;
        }

        // Find the author of the referenced tweet
        const referencedAuthor = users.find((u: TwitterUser) => u.id === referencedTweet.author_id);
        if (!referencedAuthor) {
          console.warn(`⚠️ No author found for referenced tweet ${ref.id} (author_id: ${referencedTweet.author_id})`);
        }
        
        return {
          ...ref,
          ...referencedTweet,
          author: referencedAuthor
        };
      });

      // Return the processed tweet with author information
      return {
        ...tweet,
        author // Attach the author directly to the tweet
      };
    });
  }

  async fetchMentionsFromAPI(): Promise<TwitterAPITweet[]> {
    if (this.devMode) {
      console.log('🎭 Using mock mentions data');
      const mockData = await this.loadMockData('mentions');
      return this.processTweetsResponse(mockData);
    }

    console.log('🔍 Fetching mentions from X API...');
    
    const allMentions: TwitterAPITweet[] = [];
    let nextToken: string | undefined;
    
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const url = 'https://api.twitter.com/2/tweets/search/recent';
        const params = new URLSearchParams({
          'query': '@SentientAmariel -is:retweet',
          'tweet.fields': 'author_id,conversation_id,created_at,in_reply_to_user_id,referenced_tweets,public_metrics',
          'expansions': 'author_id,referenced_tweets.id,referenced_tweets.id.author_id,in_reply_to_user_id',
          'user.fields': 'id,name,username',
          'max_results': '100',
          ...(nextToken && { 'next_token': nextToken })
        });

        console.log('📡 Making API request:', url, '\nParams:', Object.fromEntries(params.entries()));
        const response = await this.makeAuthenticatedRequest(url, 'GET', params);

        if (!response.ok) {
          const error = await response.json();
          console.error('❌ API request failed:', {
            status: response.status,
            error,
            headers: Object.fromEntries(response.headers.entries())
          });
          throw {
            status: response.status,
            response,
            message: error.detail || 'Failed to fetch mentions'
          };
        }

        const data = await response.json() as TwitterResponse;
        const processedMentions = this.processTweetsResponse(data);
        allMentions.push(...processedMentions);
        
        nextToken = data.meta?.next_token;
        
      } catch (error) {
        console.error('❌ Error fetching mentions:', error);
        break;
      }
    } while (nextToken);

    console.log(`✅ Total mentions fetched: ${allMentions.length}`);
    return allMentions;
  }

  async processMentions(rawMentions: TwitterAPITweet[]): Promise<void> {
    console.log('🔄 Processing mentions...');
    
    const BATCH_SIZE = 50;
    
    // First ensure all referenced tweets exist
    const referencedTweetIds = new Set(
      rawMentions
        .map(tweet => tweet.referenced_tweets?.find(ref => ref.type === 'replied_to')?.id)
        .filter(id => id) as string[]
    );

    // Fetch existing tweets to avoid duplicates
    const existingTweets = await prisma.tweet.findMany({
      where: {
        id: {
          in: Array.from(referencedTweetIds)
        }
      }
    });

    const existingTweetIds = new Set(existingTweets.map(t => t.id));

    // Create missing tweets as placeholders
    const missingTweetIds = Array.from(referencedTweetIds).filter(id => !existingTweetIds.has(id));
    
    for (let i = 0; i < missingTweetIds.length; i += BATCH_SIZE) {
      const batch = missingTweetIds.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(id =>
          prisma.tweet.create({
            data: {
              id,
              text: '[Original tweet not cached]',
              authorId: 'unknown',
              authorName: 'Tweet not yet loaded',
              username: 'unknown',
              createdAt: new Date(),
              cachedAt: new Date(),
              published: true,
              isMock: false,
              metrics: {
                replyCount: 0,
                retweetCount: 0,
                likeCount: 0
              }
            }
          })
        )
      );
    }

    // Process mentions in batches
    for (let i = 0; i < rawMentions.length; i += BATCH_SIZE) {
      const batch = rawMentions.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async tweet => {
          const replyToId = tweet.referenced_tweets?.find(ref => ref.type === 'replied_to')?.id;
          
          try {
            // Check if this mention already has a response
            const existingMention = await prisma.mention.findUnique({
              where: { id: tweet.id },
              include: { response: true }
            });

            const status = existingMention?.response ? 'RESPONDED' : 'PENDING';
            
            await prisma.mention.upsert({
              where: { id: tweet.id },
              update: {
                text: tweet.text,
                authorId: tweet.author_id,
                authorName: tweet.author?.name || 'Unknown User',
                username: tweet.author?.username || 'unknown',
                status,
                type: replyToId ? 'REPLY' : 'MENTION',
                inReplyToId: replyToId
              },
              create: {
                id: tweet.id,
                text: tweet.text,
                authorId: tweet.author_id,
                authorName: tweet.author?.name || 'Unknown User',
                username: tweet.author?.username || 'unknown',
                createdAt: new Date(tweet.created_at),
                status,
                type: replyToId ? 'REPLY' : 'MENTION',
                inReplyToId: replyToId
              }
            });
          } catch (error) {
            console.error(`Error processing mention ${tweet.id}:`, error);
          }
        })
      );
    }
    
    console.log('✅ Finished processing mentions');
  }

  async postTweet(content: string, conversationId?: string, isMock: boolean = false) {
    console.log('🐦 Posting tweet:', { content, conversationId, isMock });
    
    if (isMock) {
      console.log('🎭 Creating mock tweet');
      const mockTweet = await prisma.tweet.create({
        data: {
          id: `mock_tweet_${Date.now()}`,
          text: content,
          authorId: 'mock_user',
          authorName: process.env.X_USERNAME || 'Amariel',
          username: process.env.X_USERNAME || 'SentientAmariel',
          createdAt: new Date(),
          cachedAt: new Date(),
          conversationId: conversationId ?? null,
          inReplyToId: null,
          metrics: {
            replyCount: 0,
            retweetCount: 0,
            likeCount: 0
          },
          published: false,
          isMock: true
        }
      });
      console.log('✅ Created mock tweet:', mockTweet);
      
      return {
        data: {
          id: mockTweet.id,
          text: mockTweet.text
        }
      };
    }

    const url = 'https://api.twitter.com/2/tweets';
    const response = await this.makeAuthenticatedRequest(
      url,
      'POST',
      undefined,
      { text: content }
    );

    if (!response.ok) {
      const error = await response.json();
      throw {
        status: response.status,
        response,
        message: error.detail || 'Failed to post tweet'
      };
    }

    const tweetData = await response.json();
    
    // Cache the real tweet in our database
    const cachedTweet = await prisma.tweet.create({
      data: {
        id: tweetData.data.id,
        text: content,
        authorId: process.env.X_USER_ID!,
        authorName: process.env.X_USERNAME || 'Amariel',
        username: process.env.X_USERNAME || 'SentientAmariel',
        createdAt: new Date(),
        cachedAt: new Date(),
        conversationId: conversationId ?? null,
        inReplyToId: null,
        metrics: {
          replyCount: 0,
          retweetCount: 0,
          likeCount: 0
        },
        published: true,
        isMock: false
      }
    });
    console.log('✅ Cached real tweet:', cachedTweet);

    return tweetData;
  }

  async replyToTweet(content: string, tweetId: string, isMock: boolean = false) {
    console.log('🐦 Replying to tweet:', { tweetId, content, isMock });
    
    if (isMock) {
      console.log('🎭 Creating mock reply');
      const mockReply = await prisma.tweet.create({
        data: {
          id: `mock_reply_${Date.now()}`,
          text: content,
          authorId: 'mock_user',
          authorName: process.env.X_USERNAME || 'Amariel',
          username: process.env.X_USERNAME || 'SentientAmariel',
          createdAt: new Date(),
          cachedAt: new Date(),
          conversationId: null,
          inReplyToId: tweetId,
          metrics: {
            replyCount: 0,
            retweetCount: 0,
            likeCount: 0
          },
          published: false,
          isMock: true
        }
      });
      console.log('✅ Created mock reply:', mockReply);
      
      return {
        data: {
          id: mockReply.id,
          text: mockReply.text
        }
      };
    }

    const url = 'https://api.twitter.com/2/tweets';
    const response = await this.makeAuthenticatedRequest(
      url,
      'POST',
      undefined,
      { 
        text: content,
      reply: {
          in_reply_to_tweet_id: tweetId
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw {
        status: response.status,
        response,
        message: error.detail || 'Failed to post reply'
      };
    }

    const replyData = await response.json();
    
    // Cache the real reply in our database
    const cachedReply = await prisma.tweet.create({
      data: {
        id: replyData.data.id,
        text: content,
        authorId: process.env.X_USER_ID!,
        authorName: process.env.X_USERNAME || 'Amariel',
        username: process.env.X_USERNAME || 'SentientAmariel',
        createdAt: new Date(),
        cachedAt: new Date(),
        conversationId: null,
        inReplyToId: tweetId,
        metrics: {
          replyCount: 0,
          retweetCount: 0,
          likeCount: 0
        },
        published: true,
        isMock: false
      }
    });
    console.log('✅ Cached real reply:', cachedReply);

    return replyData;
  }

  async likeTweet(tweetId: string, isMock: boolean = false) {
    if (isMock) {
      console.log('🎭 Simulating like for mock tweet:', tweetId);
      // Update mock tweet metrics in database
      await prisma.tweet.update({
        where: { id: tweetId },
        data: {
          metrics: {
            update: {
              likeCount: {
                increment: 1
              }
            }
          }
        }
      });
      return;
    }

    const userId = process.env.X_USER_ID;
    const url = `https://api.twitter.com/2/users/${userId}/likes`;
    const response = await this.makeAuthenticatedRequest(
      url,
      'POST',
      undefined,
      { tweet_id: tweetId }
    );

    if (!response.ok) {
      const error = await response.json();
      throw {
        status: response.status,
        response,
        message: error.detail || 'Failed to like tweet'
      };
    }

    return await response.json();
  }

  async checkAndRespondToMentions() {
    // Get both real mentions from X API and mock mentions from our database
    const [apiMentions, mockMentions] = await Promise.all([
      this.fetchMentionsFromAPI(),
      this.fetchMockMentions()
    ]);

    return [...apiMentions, ...mockMentions];
  }

  private async fetchMockMentions() {
    return prisma.mention.findMany({
      where: {
        isMock: true,
        response: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getPosts() {
    return this.getUserTweets();
  }

  async getUserTweets(): Promise<PrismaTweet[]> {
    console.log('🔍 Starting getUserTweets...');
    
    const userId = process.env.X_USER_ID;
    if (!userId) {
      throw new Error('X_USER_ID is required to fetch tweets');
    }

    try {
      // 1. Fetch all tweets and mentions
      console.log('📥 Fetching all tweets and mentions...');
      const [rawTweets, rawMentions] = await Promise.all([
        this.fetchTweetsFromAPI(userId),
        this.fetchMentionsFromAPI()
      ]);

      console.log('📊 Fetched counts:', {
        tweets: rawTweets.length,
        mentions: rawMentions.length
      });

      // 2. Combine tweets and mentions into a single list
      const allTweets = [...rawTweets, ...rawMentions];

      // 3. Create conversation map
      const conversationMap: ConversationMap = new Map();
      
      allTweets.forEach(tweet => {
        // Use either conversation_id or the tweet's own id as the conversation id
        const conversationId = tweet.conversation_id || tweet.id;
        
        if (!conversationMap.has(conversationId)) {
          conversationMap.set(conversationId, []);
        }
        
        conversationMap.get(conversationId)!.push(tweet);
      });

      // 4. Sort tweets within each conversation by creation date
      for (const [conversationId, tweets] of Array.from(conversationMap.entries())) {
        tweets.sort((a: TwitterAPITweet, b: TwitterAPITweet) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }

      // 5. Process conversations in order and create DB records
      const processedTweets: PrismaTweet[] = [];
      const BATCH_SIZE = 50;
      let currentBatch: Promise<void>[] = [];

      for (const [conversationId, tweets] of Array.from(conversationMap.entries())) {
        // Process each conversation as a batch
        const processConversation = async () => {
          try {
            // First, ensure all referenced tweets exist
            const referencedTweetIds = new Set(
              tweets
                .map(tweet => tweet.referenced_tweets?.find(ref => ref.type === 'replied_to')?.id)
                .filter((id): id is string => id !== undefined)
            );

            // Create any missing referenced tweets as placeholders
            for (const id of Array.from(referencedTweetIds)) {
              await prisma.tweet.upsert({
                where: { id },
                update: {},
                create: {
                  id,
                  text: '[Original tweet not cached]',
                  authorId: 'unknown',
                  authorName: 'Tweet not yet loaded',
                  username: 'unknown',
                  createdAt: new Date(),
                  cachedAt: new Date(),
                  published: true,
                  isMock: false,
                  metrics: {
                    replyCount: 0,
                    retweetCount: 0,
                    likeCount: 0
                  }
                }
              });
            }

            // Process tweets in chronological order
            for (const tweet of tweets) {
              const replyToId = tweet.referenced_tweets?.find((ref): ref is typeof ref & { id: string } => ref.type === 'replied_to')?.id;
              const isAmarielTweet = tweet.author_id === process.env.X_USER_ID;

              // Create or update the tweet
              const dbTweet = await prisma.tweet.upsert({
                where: { id: tweet.id },
                update: {
                  text: tweet.text,
                  cachedAt: new Date(),
                  authorId: tweet.author_id || 'unknown',
                  authorName: tweet.author?.name || (isAmarielTweet ? process.env.X_USERNAME || 'Amariel' : 'Unknown User'),
                  username: tweet.author?.username || (isAmarielTweet ? process.env.X_USERNAME || 'SentientAmariel' : 'unknown'),
                  conversationId: tweet.conversation_id || null,
                  inReplyToId: replyToId || null,
                  metrics: {
                    replyCount: tweet.public_metrics?.reply_count ?? 0,
                    retweetCount: tweet.public_metrics?.retweet_count ?? 0,
                    likeCount: tweet.public_metrics?.like_count ?? 0
                  }
                },
                create: {
                  id: tweet.id,
                  text: tweet.text,
                  authorId: tweet.author_id || 'unknown',
                  authorName: tweet.author?.name || (isAmarielTweet ? process.env.X_USERNAME || 'Amariel' : 'Unknown User'),
                  username: tweet.author?.username || (isAmarielTweet ? process.env.X_USERNAME || 'SentientAmariel' : 'unknown'),
                  createdAt: new Date(tweet.created_at),
                  cachedAt: new Date(),
                  conversationId: tweet.conversation_id || null,
                  inReplyToId: replyToId || null,
                  metrics: {
                    replyCount: tweet.public_metrics?.reply_count ?? 0,
                    retweetCount: tweet.public_metrics?.retweet_count ?? 0,
                    likeCount: tweet.public_metrics?.like_count ?? 0
                  },
                  published: true,
                  isMock: false
                }
              });

              processedTweets.push(dbTweet);

              // If this is a mention of Amariel, create or update the mention record
              if (!isAmarielTweet && tweet.text.includes('@SentientAmariel')) {
                // Find if Amariel has replied to this mention
                const hasResponse = tweets.some(t => {
                  const isAmarielReply = t.author_id === process.env.X_USER_ID;
                  const isReplyToThisTweet = t.referenced_tweets?.some(
                    ref => ref.type === 'replied_to' && ref.id === tweet.id
                  );
                  return isAmarielReply && isReplyToThisTweet;
                });

                await prisma.mention.upsert({
                  where: { id: tweet.id },
                  update: {
                    text: tweet.text,
                    authorId: tweet.author_id,
                    authorName: tweet.author?.name || 'Unknown User',
                    username: tweet.author?.username || 'unknown',
                    status: hasResponse ? 'RESPONDED' : 'PENDING',
                    type: replyToId ? 'REPLY' : 'MENTION',
                    inReplyToId: replyToId
                  },
                  create: {
                    id: tweet.id,
                    text: tweet.text,
                    authorId: tweet.author_id,
                    authorName: tweet.author?.name || 'Unknown User',
                    username: tweet.author?.username || 'unknown',
                    createdAt: new Date(tweet.created_at),
                    status: hasResponse ? 'RESPONDED' : 'PENDING',
                    type: replyToId ? 'REPLY' : 'MENTION',
                    inReplyToId: replyToId
                  }
                });
              }
            }
          } catch (error) {
            console.error(`Error processing conversation ${conversationId}:`, error);
          }
        };

        currentBatch.push(processConversation());

        if (currentBatch.length >= BATCH_SIZE) {
          await Promise.all(currentBatch);
          currentBatch = [];
        }
      }

      // Process any remaining conversations
      if (currentBatch.length > 0) {
        await Promise.all(currentBatch);
      }

      // Get mock tweets
      const mockTweets = await this.fetchMockTweets();
      console.log(`🎭 Found ${mockTweets.length} mock tweets`);

      // Combine all tweets and sort by creation date
      const combinedTweets = [...processedTweets, ...mockTweets].sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );

      console.log('📊 Final counts:', {
        processedTweets: processedTweets.length,
        mockTweets: mockTweets.length,
        total: combinedTweets.length
      });

      return combinedTweets;
    } catch (error) {
      console.error('❌ Error in getUserTweets:', error);
      // If API fails, fall back to database
      console.log('⚠️ Falling back to database only');
      const dbTweets = await prisma.tweet.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return dbTweets;
    }
  }

  private async fetchMockTweets(): Promise<PrismaTweet[]> {
    return prisma.tweet.findMany({
      where: {
        isMock: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
} 