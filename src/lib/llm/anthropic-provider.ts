import '@anthropic-ai/sdk/shims/node';
import { LLMProvider } from './llm-provider-interface';
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from '@langchain/core/messages';
import { modelConfig } from '../../config/models';

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private models: Array<{ name: string; supportsImages: boolean }>;

  constructor(apiKey: string = process.env.ANTHROPIC_API_KEY || '') {
    this.apiKey = apiKey;
    if (!this.apiKey) {
      console.warn('ANTHROPIC_API_KEY is not set. Anthropic provider may not work correctly.');
    }
    this.models = modelConfig.anthropic;
  }

  async getModels(): Promise<Array<{ name: string; supportsImages: boolean }>> {
    return this.models;
  }

  supportsImages(model: string): boolean {
    const modelInfo = this.models.find(m => m.name === model);
    return modelInfo ? modelInfo.supportsImages : false;
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

    const message = new HumanMessage({
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${base64Image}` },
        },
      ],
    });

    const response = await anthropic.invoke([message]);

    if (typeof response.content !== 'string') {
      throw new Error('Unexpected response format from Anthropic');
    }
    return response.content;
  }
}
