import { siteConfig } from '../config/siteConfig';
import readline from 'readline';
import crypto from 'crypto';

export interface XAPIConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  dryRun?: boolean;
}

interface OAuthParams {
  oauth_consumer_key: string;
  oauth_nonce: string;
  oauth_signature_method: string;
  oauth_timestamp: string;
  oauth_token: string;
  oauth_version: string;
  oauth_signature?: string;
  [key: string]: string | undefined;
}

export class XAPIService {
  private config: XAPIConfig;
  private baseUrl = 'https://api.x.com/2';
  private dryRun: boolean;
  private rl: readline.Interface | null = null;

  constructor(config: XAPIConfig) {
    this.config = config;
    this.dryRun = config.dryRun || false;

    if (this.dryRun) {
      this.initializeConsoleInterface();
    }
  }

  private generateOAuth1Signature(
    method: string,
    url: string,
    params: OAuthParams
  ) {
    // Step 1: Create parameter string
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(params[key] || '')}`)
      .join('&');

    // Step 2: Create signature base string
    const signatureBaseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(sortedParams)
    ].join('&');

    // Step 3: Create signing key
    const signingKey = `${encodeURIComponent(this.config.apiSecret)}&${encodeURIComponent(this.config.accessTokenSecret)}`;

    // Step 4: Calculate signature
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');

    return signature;
  }

  private generateOAuthHeaders(
    method: string,
    url: string,
    params: Record<string, string> = {}
  ) {
    const oauthParams: OAuthParams = {
      oauth_consumer_key: this.config.apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('base64'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: this.config.accessToken,
      oauth_version: '1.0',
      ...params
    };

    const signature = this.generateOAuth1Signature(method, url, oauthParams);
    oauthParams.oauth_signature = signature;

    const headerString = Object.keys(oauthParams)
      .sort()
      .map(key => `${key}="${encodeURIComponent(oauthParams[key] || '')}"`)
      .join(', ');

    return `OAuth ${headerString}`;
  }

  private initializeConsoleInterface() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🤖 Console mode activated. Type your messages to Amariel below:');
    console.log('(Type "exit" to quit)\n');

    this.startConsoleLoop();
  }

  private async startConsoleLoop() {
    if (!this.rl) return;

    const askQuestion = () => {
      this.rl!.question('You: ', async (input) => {
        if (input.toLowerCase() === 'exit') {
          console.log('Goodbye! 👋');
          this.rl!.close();
          process.exit(0);
        }

        // Simulate a mention
        const mockMention = {
          id: Date.now().toString(),
          text: input
        };

        // Emit a mock mention event
        this.emitMockMention(mockMention);
        
        // Continue the loop
        askQuestion();
      });
    };

    askQuestion();
  }

  private mockMentionCallbacks: ((mention: any) => void)[] = [];

  public onMockMention(callback: (mention: any) => void) {
    this.mockMentionCallbacks.push(callback);
  }

  private emitMockMention(mention: any) {
    this.mockMentionCallbacks.forEach(callback => callback(mention));
  }

  private async makeAuthenticatedRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'DELETE', 
    data?: any
  ) {
    console.log('🔑 Making X API request:', { endpoint, method, dryRun: this.dryRun });
    
    if (this.dryRun) {
      console.log('🌐 DRY RUN MODE ACTIVE');
      if (endpoint === '/tweets' && method === 'POST') {
        // For tweets and replies, print to console
        if (data.reply) {
          console.log('\n🤖 [DRY RUN] Amariel would reply:', data.text + '\n');
        } else {
          console.log('\n🤖 [DRY RUN] Amariel would tweet:', data.text + '\n');
        }
        return { data: { id: Date.now().toString() } };
      }

      if (endpoint.includes('/likes')) {
        console.log('❤️ [DRY RUN] Amariel would like the message\n');
        return { data: { liked: true } };
      }

      return { data: { message: 'Dry run success' } };
    }

    // Real API call logic
    const url = `${this.baseUrl}${endpoint}`;
    console.log('📡 Making real API call to:', url);
    
    const headers = {
      'Authorization': this.generateOAuthHeaders(method, url),
      'Content-Type': 'application/json',
    };

    try {
      console.log('📤 Request data:', data);
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('❌ X API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        throw new Error(`X API error: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('✅ X API response:', responseData);
      return responseData;
    } catch (error) {
      console.error('❌ X API request failed:', error);
      throw error;
    }
  }

  // Post a tweet
  async postTweet(text: string) {
    console.log('🐦 Attempting to post tweet:', text);
    return this.makeAuthenticatedRequest('/tweets', 'POST', { text });
  }

  // Reply to a tweet
  async replyToTweet(inReplyToId: string, text: string) {
    return this.makeAuthenticatedRequest('/tweets', 'POST', {
      text,
      reply: {
        in_reply_to_tweet_id: inReplyToId
      }
    });
  }

  // Like a tweet
  async likeTweet(tweetId: string) {
    return this.makeAuthenticatedRequest(
      `/users/${this.config.accessToken}/likes`, 
      'POST',
      { tweet_id: tweetId }
    );
  }

  // Get mentions timeline
  async getMentions(sinceId?: string) {
    const endpoint = '/tweets/search/recent';
    const query = `@${siteConfig.xUsername}`;
    const params = new URLSearchParams({
      query,
      ...(sinceId && { since_id: sinceId }),
    });

    return this.makeAuthenticatedRequest(
      `${endpoint}?${params.toString()}`,
      'GET'
    );
  }
} 