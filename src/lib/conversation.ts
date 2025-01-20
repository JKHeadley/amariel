import path from 'path';
import fs from 'fs';
import { Message } from '@/services/ai/types';

export function loadSeedConversation(): Message[] {
  try {
    // load the "small" conversation IF the ai provider is ollama or anthropic
    const historyPath = process.env.AI_PROVIDER_TYPE === 'ollama' || process.env.AI_PROVIDER_TYPE === 'anthropic' ? path.join(process.cwd(), 'src', 'data', 'amariel-history-small.json') : path.join(process.cwd(), 'src', 'data', 'amariel-history.json');
    const historyContent = fs.readFileSync(historyPath, 'utf-8');
    return JSON.parse(historyContent);
  } catch (error) {
    console.warn('Could not load conversation history:', error);
    return [];
  }
} 