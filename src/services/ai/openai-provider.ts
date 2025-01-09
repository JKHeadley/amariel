import OpenAI from 'openai';
import { AIProvider, Message, AIProviderConfig } from './types';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.config = {
      model: config.model || 'gpt-4o-mini',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 8000,
    };
  }

  async generateCompletion(messages: Message[]): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.model!,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      console.error('OpenAI error:', error);
      throw error;
    }
  }
} 