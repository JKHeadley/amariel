export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  type?: 'text';
}

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIProvider {
  generateCompletion(messages: Message[]): Promise<string>;
} 

export function printMessages(messages: Message[]) {
  console.log(messages.map(msg => `${msg.role}:\n${msg.content}\n`).join("\n"));
}