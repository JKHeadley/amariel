export interface AIProvider {
  generateResponse(context: string): Promise<string>;
  generateThought(context: string): Promise<string>;
  config: {
    apiKey: string;
    model?: string;
  };
} 