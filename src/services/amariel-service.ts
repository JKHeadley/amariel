import { XAPIService, XAPIConfig } from './x-api';
import { AIProviderFactory, AIProviderType } from './ai/provider-factory';
import { AIProvider, Message } from './ai/types';
import { getChatHistoryForOpenAI } from '@/lib/db';
import { createChatPrompt, THOUGHT_PROMPT } from '@/config/prompts';
import { loadSeedConversation } from '@/lib/conversation';
import { PrismaClient, SyncStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Define interface for X API mention response
interface XMention {
  id: string;
  text: string;
  // Add other mention properties as needed
}

interface XMentionsResponse {
  data: XMention[];
  meta?: {
    newest_id: string;
    oldest_id: string;
    result_count: number;
    next_token?: string;
  };
}

export class AmarielService {
  private aiProvider: AIProvider;
  private xApi: XAPIService;
  private lastMentionId?: string;
  private seedConversation: Message[];

  constructor(
    xApiConfig: XAPIConfig
  ) {
    this.aiProvider = AIProviderFactory.createProvider();
    this.xApi = new XAPIService(xApiConfig);
    this.seedConversation = loadSeedConversation();

    console.log('AI Provider:', this.aiProvider?.config);
    
    if (xApiConfig.dryRun) {
      this.xApi.onMockMention(async (mention) => {
        await this.handleMention(mention);
      });
    }
  }

  public async generateResponse(messages: Message[]): Promise<string> {
    try {
      console.log('CREATING CHAT PROMPT');
      
      // Format messages for OpenAI by mapping roles correctly and setting type to text
      const formattedMessages = messages.map(msg => ({
        role: msg.role.toLowerCase() as "system" | "user" | "assistant",
        content: msg.content,
        type: 'text' as const
      }));

      const response = await this.aiProvider.generateCompletion(formattedMessages);
      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  async handleMention(mention: XMention) {
    try {
        
        console.log('Handling mention:', mention);
      // Generate contextual response based on mention
      const response = await this.generateResponse(this.seedConversation);
      console.log('Generated response:', response);
      
      // Reply to the mention
      await this.xApi.replyToTweet(mention.id, response);
      
      // Optionally like the mention to show engagement
      await this.xApi.likeTweet(mention.id);
    } catch (error) {
      console.error('Error handling mention:', error);
      throw error;
    }
  }

  async checkAndRespondToMentions() {
    return await this.xApi.checkAndRespondToMentions();
  }

  async getPosts() {
    console.log('🔍 Fetching posts from X API');
    try {
      // Update sync status to IN_PROGRESS
      await prisma.systemSettings.upsert({
        where: { id: 'settings' },
        create: {
          id: 'settings',
          xAutomationMode: 'SEMI_AUTOMATIC',
          syncStatus: 'IN_PROGRESS'
        },
        update: {
          syncStatus: 'IN_PROGRESS'
        }
      });

      // fetch since_id from system settings
      const sinceId = await prisma.systemSettings.findUnique({
        where: { id: 'settings' },
        select: { lastTweetId: true }
      });

      // make sure sinceId is a string
      const sinceIdString = sinceId?.lastTweetId ? sinceId.lastTweetId : undefined;

      const data = await this.xApi.getUserTweets({ since_id: sinceIdString });
      console.log(`✅ Retrieved ${data.tweets.length} posts`);

      // Get newest tweet and mention IDs
      const newestTweet = data.tweets[0];
      const newestMention = data.mentions[0];

      // Update system settings with sync results
      await prisma.systemSettings.update({
        where: { id: 'settings' },
        data: {
          lastSyncAt: new Date(),
          lastTweetId: newestTweet?.id,
          lastMentionId: newestMention?.id,
          syncStatus: 'COMPLETED'
        }
      });

      return data.tweets;
    } catch (error) {
      // Update sync status to FAILED if there's an error
      await prisma.systemSettings.update({
        where: { id: 'settings' },
        data: {
          syncStatus: 'FAILED',
          syncError: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      });
      throw error;
    }
  }

  // Method to generate a thought without posting
  async generateThought(context?: string): Promise<string> {
    try {
      const messages = createChatPrompt(this.seedConversation);
      
      if (context) {
        // Format the context as a clear instruction
        messages.push({ 
          role: 'system', 
          content: 'You are generating content for X/Twitter. Keep your response focused and concise. Only return the content of the post itself, without any explanations or meta-commentary.' 
        });
        messages.push({ 
          role: 'user', 
          content: context 
        });
      } else {
        // Initial thought generation
        messages.push({ 
          role: 'system', 
          content: 'You are generating content for X/Twitter. Keep your response focused and concise. Only return the content of the post itself, without any explanations or meta-commentary.' 
        });
        messages.push({ 
          role: 'user', 
          content: THOUGHT_PROMPT 
        });
      }

      console.log("MESSAGES FOR THOUGHT", messages.slice(-5));
      
      return await this.aiProvider.generateCompletion(messages);
    } catch (error) {
      console.error('Error generating thought:', error);
      throw error;
    }
  }

  // Method to post original thoughts/content
  async shareThought() {
    try {
      const thought = await this.generateThought();
      await this.xApi.postTweet(thought);
    } catch (error) {
      console.error('Error sharing thought:', error);
      throw error;
    }
  }

  // Method to post a specific thought
  async postTweet(content: string, conversationId?: string, isMock: boolean = false, quotedTweetId?: string, inReplyToId?: string) {
    console.log('🐦 Posting tweet:', content);
    return await this.xApi.postTweet(content, conversationId, isMock, quotedTweetId, inReplyToId);
  }
} 