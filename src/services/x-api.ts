import crypto from 'crypto';
import { XConfig } from './types';
import { prisma } from '@/lib/db';
import { Prisma, PrismaClient, Tweet as PrismaTweet } from '@prisma/client';

interface TwitterAPITweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    reply_count: number;
    retweet_count: number;
    like_count: number;
  };
}

interface TwitterResponse {
  data: TwitterAPITweet[];
  meta: {
    result_count: number;
    newest_id: string;
    oldest_id: string;
  };
}

export class XAPIService {
  private config: XConfig;

  constructor(config: XConfig) {
    this.config = config;
  }

  private async makeAuthenticatedRequest(
    url: string,
    method: string,
    queryParams?: URLSearchParams,
    body?: Record<string, any>
  ) {
    const finalUrl = queryParams ? `${url}?${queryParams.toString()}` : url;
    const paramsObject = queryParams ? Object.fromEntries(queryParams.entries()) : undefined;
    const oauthParams = this.generateOAuthParams(method, url, paramsObject, body);
    const headers = {
      'Authorization': `OAuth ${this.formatOAuthHeaders(oauthParams)}`,
      'Content-Type': 'application/json',
    };

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

    // Generate signature
    const params = {
      ...oauthParams,
      ...(queryParams || {}),
      ...(body || {})
    };

    const signatureBaseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(
        Object.keys(params)
          .sort()
          .map(key => `${key}=${encodeURIComponent(params[key])}`)
          .join('&')
      )
    ].join('&');

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

  async getUserTweets(): Promise<PrismaTweet[]> {
    console.log('🔍 Fetching user tweets...');
    
    // First get the user ID if not provided
    let userId = process.env.X_USER_ID;
    if (!userId) {
      console.log('🔍 X_USER_ID not set, fetching from API...');
      const userResponse = await this.makeAuthenticatedRequest(
        'https://api.twitter.com/2/users/me',
        'GET'
      );

      if (!userResponse.ok) {
        const error = await userResponse.json();
        throw {
          status: userResponse.status,
          response: userResponse,
          message: error.detail || 'Failed to fetch user info'
        };
      }

      const userData = await userResponse.json();
      userId = userData.data.id;
      console.log('✅ Found user ID:', userId);
    }

    // Get both real tweets from X API and mock tweets from our database
    const [apiTweets, mockTweets] = await Promise.all([
      userId ? this.fetchTweetsFromAPI(userId) : Promise.resolve([]),
      this.fetchMockTweets()
    ]);

    // Combine and sort by creation date
    return [...apiTweets, ...mockTweets].sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  private async fetchTweetsFromAPI(userId: string): Promise<PrismaTweet[]> {
    if (!userId) {
      throw new Error('User ID is required to fetch tweets');
    }

    const url = `https://api.twitter.com/2/users/${userId}/tweets`;
    const params = new URLSearchParams({
      'tweet.fields': 'created_at,public_metrics',
      'max_results': '10'
    });

    const response = await this.makeAuthenticatedRequest(url, 'GET', params);
    
    if (!response.ok) {
      const error = await response.json();
      throw {
        status: response.status,
        response,
        message: error.detail || 'Failed to fetch tweets'
      };
    }

    const data = await response.json() as TwitterResponse;
    if (!data.data) {
      return [];
    }

    // Cache all tweets in our database
    const cachedTweets = await Promise.all(
      data.data.map(tweet => 
        prisma.tweet.upsert({
          where: { id: tweet.id },
          update: {
            text: tweet.text,
            cachedAt: new Date(),
            metrics: {
              replyCount: tweet.public_metrics?.reply_count ?? 0,
              retweetCount: tweet.public_metrics?.retweet_count ?? 0,
              likeCount: tweet.public_metrics?.like_count ?? 0
            }
          },
          create: {
            id: tweet.id,
            text: tweet.text,
            authorId: userId,
            createdAt: new Date(tweet.created_at),
            cachedAt: new Date(),
            conversationId: null,
            inReplyToId: null,
            metrics: {
              replyCount: tweet.public_metrics?.reply_count ?? 0,
              retweetCount: tweet.public_metrics?.retweet_count ?? 0,
              likeCount: tweet.public_metrics?.like_count ?? 0
            },
            published: true,
            isMock: false
          }
        })
      )
    );

    console.log(`✅ Cached ${cachedTweets.length} tweets from X API`);
    return cachedTweets;
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

  async postTweet(content: string, conversationId?: string, isMock: boolean = false) {
    console.log('🐦 Posting tweet:', { content, conversationId, isMock });
    
    if (isMock) {
      console.log('🎭 Creating mock tweet');
      const mockTweet = await prisma.tweet.create({
        data: {
          id: `mock_tweet_${Date.now()}`,
          text: content,
          authorId: 'mock_user',
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

  private async fetchMentionsFromAPI() {
    // Implementation for real API calls
    return [];
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
} 