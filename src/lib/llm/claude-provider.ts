import { LLMProvider } from './llm-provider-interface';
import { ChatAnthropicMessages } from "@langchain/anthropic";

export class ClaudeProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string = process.env.ANTHROPIC_API_KEY || '') {
    this.apiKey = apiKey;
    if (!this.apiKey) {
      console.warn('ANTHROPIC_API_KEY is not set. Claude provider may not work correctly.');
    }
  }

  async getModels(): Promise<string[]> {
    console.log('Fetching Anthropic models...');
    try {
      // This is a simplified list. In a real implementation, you'd fetch this from Anthropic's API.
      const models = ['claude-2.1', 'claude-3-5-sonnet-20240620'];
      console.log('Anthropic models:', models);
      return models;
    } catch (error) {
      console.error('Error fetching Anthropic models:', error);
      return [];
    }
  }

  async generateResponse(prompt: string, model: string): Promise<string> {
    console.log(`Generating response with Anthropic model: ${model}`);
    try {
      if (!this.apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set');
      }
      const claude = new ChatAnthropicMessages({
        anthropicApiKey: this.apiKey,
        modelName: model,
      });
      const response = await claude.invoke([{ type: "human", content: prompt }]);
      console.log('Claude response generated successfully');
      return response.content;
    } catch (error) {
      console.error('Error generating response with Claude:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }
}
