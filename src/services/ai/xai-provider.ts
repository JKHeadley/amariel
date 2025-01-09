import fetch from 'node-fetch';
import { AIProvider, Message, AIProviderConfig } from './types';

export class XAIProvider implements AIProvider {
  private apiKey: string;
  private config: AIProviderConfig;
  private baseUrl = 'https://api.x.ai/v1';

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.config = {
      model: config.model || 'grok-beta',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 8000,
    };
  }

  async generateCompletion(messages: Message[]): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          messages,
          model: this.config.model,
          stream: false,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        }),
      });

      if (!response.ok) {
        throw new Error(`xAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('xAI error:', error);
      throw error;
    }
  }
} 