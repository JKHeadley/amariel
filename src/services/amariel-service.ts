import { XAPIService, XAPIConfig } from './x-api';
import { AIProviderFactory, AIProviderType } from './ai/provider-factory';
import { AIProvider, Message } from './ai/types';
import { getChatHistoryForOpenAI } from '@/lib/db';
import { createChatPrompt, THOUGHT_PROMPT } from '@/config/prompts';
import { loadSeedConversation } from '@/lib/conversation';

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
    aiProviderType: AIProviderType,
    aiConfig: { apiKey: string; model?: string },
    xApiConfig: XAPIConfig
  ) {
    this.aiProvider = AIProviderFactory.createProvider(aiProviderType, aiConfig);
    this.xApi = new XAPIService(xApiConfig);
    this.seedConversation = loadSeedConversation();

    console.log('AI Provider:', this.aiProvider);
    
    if (xApiConfig.dryRun) {
      this.xApi.onMockMention(async (mention) => {
        await this.handleMention(mention);
      });
    }
  }

  public async generateResponse(prompt: string, chatId?: string): Promise<string> {
    try {
      const messages = createChatPrompt(this.seedConversation);

      if (chatId) {
        const chatHistory = await getChatHistoryForOpenAI(chatId);
        messages.push(...chatHistory);
      }

      messages.push({ role: 'user', content: prompt });

      return await this.aiProvider.generateCompletion(messages);
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  async handleMention(mention: XMention) {
    try {
        
        console.log('Handling mention:', mention);
      // Generate contextual response based on mention
      const response = await this.generateResponse(mention.text);
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
    try {
      const mentions = await this.xApi.getMentions(this.lastMentionId) as XMentionsResponse;
      
      // Process mentions in chronological order
      if (mentions.data && Array.isArray(mentions.data)) {
        for (const mention of mentions.data.reverse()) {
          await this.handleMention(mention);
          this.lastMentionId = mention.id;
        }
      }
    } catch (error) {
      console.error('Error checking mentions:', error);
      throw error;
    }
  }

  // Method to generate a thought without posting
  async generateThought(context?: string): Promise<string> {
    try {
      const messages = createChatPrompt(this.seedConversation);
      
      if (context) {
        messages.push({ role: 'user', content: `Here's some context for your thought: ${context}` });
      }
      
      messages.push({ role: 'user', content: THOUGHT_PROMPT });
      
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
} 