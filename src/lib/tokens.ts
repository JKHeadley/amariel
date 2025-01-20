import { encoding_for_model } from 'tiktoken';
import { Message } from '@/services/ai/types';

const MODEL_TOKEN_LIMITS: { [key: string]: number } = {
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4o-mini': 250000,
  'gpt-3.5-turbo': 4096,
  'gpt-3.5-turbo-16k': 16384,
  'grok-beta': 8000,
  'llama2': 4096,
  'llama3.3': 250000,
  'default': 100000
};

export function countTokens(messages: Message[], model: string = 'default'): number {
  try {
    // Get the appropriate encoding for the model
    const enc = encoding_for_model(model === 'default' ? 'gpt-3.5-turbo' : model);

    // Count tokens in each message
    let totalTokens = 0;
    for (const message of messages) {
      // Add tokens for message role (system, user, or assistant)
      totalTokens += 4; // Each message has a 4 token overhead
      
      // Add tokens for the content
      const tokens = enc.encode(message.content);
      totalTokens += tokens.length;
    }

    // Add 3 tokens for the messages array overhead
    totalTokens += 3;

    // Free the encoder to prevent memory leaks
    enc.free();

    return totalTokens;
  } catch (error) {
    console.warn('Error counting tokens:', error);
    // Fallback: estimate 4 tokens per word
    return messages.reduce((acc, msg) => acc + msg.content.split(/\s+/).length * 4, 0);
  }
}

export function getTokenLimit(model: string = 'default'): number {
  return MODEL_TOKEN_LIMITS[model] || MODEL_TOKEN_LIMITS.default;
}

export function validateTokenCount(messages: Message[], model: string = 'default'): boolean {
  const count = countTokens(messages, model);
  const limit = getTokenLimit(model);
  console.log('🔍 Model:', model);
  console.log('🔍 Token count:', count);
  console.log('🔍 Token limit:', limit);
  return count <= limit;
} 