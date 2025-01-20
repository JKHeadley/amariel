import { AIProvider, AIProviderConfig } from './types';
import { OpenAIProvider } from './openai-provider';
import { XAIProvider } from './xai-provider';
import { OllamaProvider } from './ollama-provider';
import { AnthropicProvider } from './anthropic-provider';

export type AIProviderType = 'openai' | 'xai' | 'ollama' | 'anthropic';

export class AIProviderFactory {
  static createProvider(): AIProvider {
    const type = process.env.AI_PROVIDER_TYPE as AIProviderType;
    switch (type) {
      case 'openai':
        const config = {
          apiKey: process.env.OPENAI_API_KEY!,
          model: process.env.NEXT_PUBLIC_GPT4O_MODEL || 'gpt-4o-mini'
        }
        return new OpenAIProvider(config);
      case 'xai':
        const xaiConfig = {
          apiKey: process.env.GROK_API_KEY!,
          model: process.env.NEXT_PUBLIC_GROK_MODEL || 'llama3.1'
        }
        return new XAIProvider(xaiConfig);
      case 'ollama':
        const ollamaConfig = {
          apiKey: process.env.OLLAMA_API_KEY!,
          model: process.env.NEXT_PUBLIC_OLLAMA_MODEL || 'llama3.1'
        }
        return new OllamaProvider(ollamaConfig);
      case 'anthropic':
        const anthropicConfig = {
          apiKey: process.env.ANTROPIC_API_KEY!,
          model: process.env.NEXT_PUBLIC_CLAUDE_MODEL || 'claude-3-5-haiku-latest'
        }
        return new AnthropicProvider(anthropicConfig);
      default:
        throw new Error(`Unknown AI provider type: ${type}`);
    }
  }
} 