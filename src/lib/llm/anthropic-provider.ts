import '@anthropic-ai/sdk/shims/node';
import { LLMProvider } from './llm-provider-interface';
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from '@langchain/core/messages';
import { modelConfig } from '../../config/models';

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private models: Array<{ name: string; supportsImages: boolean; supportsAttachments: boolean }>;

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

  async initialize(): Promise<void> {
    // No asynchronous initialization needed
    return Promise.resolve();
  }

  async generateResponseWithAttachments(prompt: string, model: string, attachments: Array<{ type: string, content: string }>): Promise<string> {
    if (!this.supportsAttachments(model)) {
      throw new Error(`Model ${model} does not support attachments.`);
    }
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    console.log('Anthropic generateResponseWithAttachments - Model:', model);
    console.log('Anthropic generateResponseWithAttachments - Number of attachments:', attachments.length);

    const anthropic = new ChatAnthropic({
      anthropicApiKey: this.apiKey,
      modelName: model,
    });

    attachments.forEach((attachment, index) => {
      console.log(`Processing attachment ${index}: ${attachment.type}`);
    });

    const messageContent = [
      { type: "text", text: prompt },
      ...attachments.map(attachment => {
        if (attachment.type === "image") {
          return {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${attachment.content}` }
          };
        } else {
          return { type: "text", text: attachment.content };
        }
      })
    ];

    console.log('Message structure types:', messageContent.map(content => content.type));

    const message = new HumanMessage({
      content: messageContent
    });

    const response = await anthropic.invoke([message]);

    console.log('Anthropic response type:', typeof response.content);

    if (typeof response.content !== 'string') {
      throw new Error('Unexpected response format from Anthropic');
    }
    return response.content;
  }

  supportsAttachments(model: string): boolean {
    const modelInfo = this.models.find(m => m.name === model);
    return modelInfo ? modelInfo.supportsAttachments : false;
  }
}
