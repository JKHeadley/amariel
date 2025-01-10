import OpenAI from 'openai';
import { AIProvider, Message, AIProviderConfig } from './types';

export class OllamaProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.client = new OpenAI({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama', // required but unused
    });
    
    this.config = {
      model: config.model || 'llama2',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 8000,
    };
  }

  async generateCompletion(messages: Message[]): Promise<string> {
    try {
      console.log('Ollama request:', {
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const completion = await this.client.chat.completions.create({
        model: this.config.model!,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      console.log('Ollama response:', completion);
      return completion.choices[0].message.content || '';
    } catch (error) {
      console.error('Ollama error:', error);
      throw error;
    }
  }
} 