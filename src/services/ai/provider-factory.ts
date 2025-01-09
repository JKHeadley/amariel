import { AIProvider, AIProviderConfig } from './types';
import { OpenAIProvider } from './openai-provider';
import { XAIProvider } from './xai-provider';
import { OllamaProvider } from './ollama-provider';

export type AIProviderType = 'openai' | 'xai' | 'ollama';

export class AIProviderFactory {
  static createProvider(type: AIProviderType, config: AIProviderConfig): AIProvider {
    switch (type) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'xai':
        return new XAIProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      default:
        throw new Error(`Unknown AI provider type: ${type}`);
    }
  }
} 