import crypto from 'crypto';
import { XConfig } from './types';

interface Tweet {
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
  data: Tweet[];
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
    if (this.config.dryRun) {
      console.log('🌵 Dry run mode - simulating API request:', {
        url,
        method,
        queryParams: queryParams?.toString(),
        body
      });
      return new Response(JSON.stringify({ data: [] }));
    }

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

  async getUserTweets() {
    console.log('🔍 Fetching user tweets...');
    
    if (this.config.dryRun) {
      console.log('🌵 Dry run mode - returning mock tweets');
      return [
        {
          id: 'mock_1',
          text: 'This is a mock tweet in dry run mode',
          authorId: 'mock_user',
          createdAt: new Date().toISOString(),
          metrics: {
            replyCount: 0,
            retweetCount: 0,
            likeCount: 0
          }
        }
      ];
    }

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

    return data.data.map(tweet => ({
      id: tweet.id,
      text: tweet.text,
      authorId: userId,
      createdAt: tweet.created_at,
      metrics: {
        replyCount: tweet.public_metrics?.reply_count ?? 0,
        retweetCount: tweet.public_metrics?.retweet_count ?? 0,
        likeCount: tweet.public_metrics?.like_count ?? 0
      }
    }));
  }
} 