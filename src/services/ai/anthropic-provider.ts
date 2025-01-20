import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, Message, AIProviderConfig } from './types';
import { validateTokenCount } from '@/lib/tokens';

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'claude-3-5-haiku-latest',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 8000,
    };
  }

  async generateCompletion(messages: Message[]): Promise<string> {
    try {
      // Validate token count before making the request
      if (!validateTokenCount(messages, this.config.model)) {
        throw new Error('Token limit exceeded for model ' + this.config.model);
      }

      // Convert messages to Anthropic format
      const anthropicMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

      // System message needs to be passed as a separate parameter
      const systemMessage = messages.find(msg => msg.role === 'system')?.content;

      const completion = await this.client.messages.create({
        model: this.config.model!,
        messages: anthropicMessages.filter(msg => msg.role !== 'system'),
        system: systemMessage,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      return completion.content[0].text;
    } catch (error) {
      console.error('Anthropic error:', error);
      throw error;
    }
  }
} 