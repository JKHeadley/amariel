import crypto from 'crypto';
import { XConfig } from './types';
import { prisma } from '@/lib/db';
import { Prisma, PrismaClient, Tweet as PrismaTweet, Mention } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import { XDataProcessor } from '@/lib/x/data-processor';

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
  note_tweet?: {
    text: string;
  };
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

interface ProcessedData {
  tweets: PrismaTweet[];
  mentions: Mention[];
}

type ConversationMap = Map<string, TwitterAPITweet[]>;

export class XAPIService {
  private config: XConfig;
  private devMode: boolean;
  private dataProcessor: XDataProcessor;

  constructor(config: XConfig) {
    this.config = config;
    this.devMode = process.env.NEXT_PUBLIC_X_API_DEV_MODE === 'true';
    this.dataProcessor = new XDataProcessor(process.env.X_USER_ID!);
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

  private async fetchTweetsFromAPI(userId: string, queryParams?: { since_id?: string }): Promise<TwitterAPITweet[]> {
    if (this.devMode) {
      console.log('🎭 Using mock tweets data');
      console.log('🔍 since_id:', queryParams?.since_id);
      const mockData = await this.loadMockData('tweets');
      return this.processTweetsResponse(mockData);
    }

    if (!userId) {
      throw new Error('User ID is required to fetch tweets');
    }

    console.log('🔍 Fetching tweets for user:', userId);
    const allTweets: TwitterAPITweet[] = [];
    let nextToken: string | undefined;
    
    // log since_id
    console.log('🔍 since_id:', queryParams?.since_id);
    do {
      const url = `https://api.twitter.com/2/users/${userId}/tweets`;
      const params = new URLSearchParams({
        'tweet.fields': 'created_at,public_metrics,referenced_tweets,conversation_id,in_reply_to_user_id,author_id',
        'expansions': 'author_id,referenced_tweets.id,referenced_tweets.id.author_id,in_reply_to_user_id',
        'user.fields': 'id,name,username',
        'max_results': '10',
        ...(nextToken && { 'pagination_token': nextToken }),
        ...(queryParams?.since_id && { 'since_id': queryParams.since_id })
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

      // Return the processed tweet with author information and referenced tweets
      return {
        ...tweet,
        author,
        referenced_tweets: processedReferencedTweets || []
      };
    });
  }

  private async fetchMentionsFromAPI(queryParams?: { since_id?: string }): Promise<TwitterAPITweet[]> {
    if (this.devMode) {
      console.log('🎭 Using mock mentions data');
      console.log('🔍 since_id:', queryParams?.since_id);
      const mockData = await this.loadMockData('mentions');
      return this.processTweetsResponse(mockData);
    }

    console.log('🔍 Fetching mentions from X API...');
    
    const allMentions: TwitterAPITweet[] = [];
    let nextToken: string | undefined;
    
    do {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // log since_id
      console.log('🔍 since_id:', queryParams?.since_id);
      try {
        const url = 'https://api.twitter.com/2/tweets/search/recent';
        const params = new URLSearchParams({
          'query': '@SentientAmariel -is:retweet',
          'tweet.fields': 'author_id,conversation_id,created_at,in_reply_to_user_id,referenced_tweets,public_metrics',
          'expansions': 'author_id,referenced_tweets.id,referenced_tweets.id.author_id,in_reply_to_user_id',
          'user.fields': 'id,name,username',
          'max_results': '10',
          ...(nextToken && { 'next_token': nextToken }),
          ...(queryParams?.since_id && { 'since_id': queryParams.since_id })
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
        console.log('📥 Raw API response:', JSON.stringify(data, null, 2));
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

  async getUserTweets(queryParams?: { since_id?: string }): Promise<ProcessedData> {
    console.log('🔍 Starting getUserTweets...');
    
    const userId = process.env.X_USER_ID;
    if (!userId) {
      throw new Error('X_USER_ID is required to fetch tweets');
    }

    try {
      // 1. Fetch all tweets and mentions
      console.log('📥 Fetching all tweets and mentions...');
      const [rawTweets, rawMentions] = await Promise.all([
        this.fetchTweetsFromAPI(userId, queryParams),
        this.fetchMentionsFromAPI(queryParams)
      ]);

      console.log('📊 Fetched counts:', {
        tweets: rawTweets.length,
        mentions: rawMentions.length
      });

      // 2. Process all data
      const processedData = await this.dataProcessor.processXData(rawTweets, rawMentions);

      // 3. Get mock tweets if in dev mode
      if (this.devMode) {
        const mockTweets = await this.fetchMockTweets();
        console.log(`🎭 Found ${mockTweets.length} mock tweets`);
        processedData.tweets = [...processedData.tweets, ...mockTweets].sort((a, b) => 
          b.createdAt.getTime() - a.createdAt.getTime()
        );
      }

      return processedData;
    } catch (error) {
      console.error('❌ Error in getUserTweets:', error);
      // If API fails, fall back to database
      console.log('⚠️ Falling back to database only');
      const [dbTweets, dbMentions] = await Promise.all([
        prisma.tweet.findMany({
          orderBy: { createdAt: 'desc' }
        }),
        prisma.mention.findMany({
          orderBy: { createdAt: 'desc' }
        })
      ]);
      return { tweets: dbTweets, mentions: dbMentions };
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

  async hydrateTweets(tweetIds: string[]): Promise<TwitterAPITweet[]> {
    if (this.devMode) {
      console.log('🎭 Using mock data for tweet hydration');
      return tweetIds.map(id => ({
        id,
        text: 'Mock hydrated tweet text for development',
        author_id: process.env.X_USER_ID!,
        created_at: new Date().toISOString()
      }));
    }

    if (!tweetIds.length) {
      return [];
    }

    console.log('🔍 Hydrating tweets:', tweetIds);
    
    const url = 'https://api.twitter.com/2/tweets';
    const params = new URLSearchParams({
      'ids': tweetIds.join(','),
      'tweet.fields': 'created_at,public_metrics,referenced_tweets,conversation_id,in_reply_to_user_id,author_id,note_tweet',
      'expansions': 'author_id,referenced_tweets.id,referenced_tweets.id.author_id,in_reply_to_user_id',
      'user.fields': 'id,name,username'
    });

    console.log('📡 Making API request:', url);
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
        message: error.detail || 'Failed to hydrate tweets'
      };
    }

    const data = await response.json() as TwitterResponse;
    console.log('📥 Raw API response:', JSON.stringify(data, null, 2));
    
    return this.processTweetsResponse(data);
  }
} 