import '@anthropic-ai/sdk/shims/node';
import { LLMProvider } from './llm-provider-interface';
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from '@langchain/core/messages';

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string = process.env.ANTHROPIC_API_KEY || '') {
    this.apiKey = apiKey;
    if (!this.apiKey) {
      console.warn('ANTHROPIC_API_KEY is not set. Anthropic provider may not work correctly.');
    }
  }

  async getModels(): Promise<Array<{ name: string; supportsImages: boolean }>> {
    return [
      { name: 'claude-2.1', supportsImages: false },
      { name: 'claude-3-sonnet-20240229', supportsImages: true },
    ];
  }

  supportsImages(model: string): boolean {
    const imageCapableModels = ['claude-3-sonnet-20240229'];
    return imageCapableModels.includes(model);
  }

  async generateResponse(prompt: string, model: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    const anthropic = new ChatAnthropic({
      anthropicApiKey: this.apiKey,
      modelName: model,
    });
    const response = await anthropic.invoke(prompt);
    if (typeof response.content !== 'string') {
      throw new Error('Unexpected response format from Anthropic');
    }
    return response.content;
  }

  async generateResponseWithImage(prompt: string, model: string, base64Image: string): Promise<string> {
    if (!this.supportsImages(model)) {
      throw new Error(`Model ${model} does not support image inputs.`);
    }
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    const anthropic = new ChatAnthropic({
      anthropicApiKey: this.apiKey,
      modelName: model,
    });

    // Combine the prompt and image into a single string
    const messageContent = `${prompt}\n\n![Image](data:image/jpeg;base64,${base64Image})`;

    const response = await anthropic.invoke([
      new HumanMessage({
        content: messageContent,
      }),
    ]);

    if (typeof response.content !== 'string') {
      throw new Error('Unexpected response format from Anthropic');
    }
    return response.content;
  }
}
