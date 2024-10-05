/**
 * OllamaProvider Module
 * 
 * This module implements the LLMProvider interface for the Ollama language model service.
 * It provides functionality to interact with Ollama models, including fetching available models
 * and generating responses to prompts.
 */

import { LLMProvider } from './llm-provider-interface';
import { ChatOllama } from "@langchain/ollama";

/**
 * OllamaProvider class
 * 
 * This class implements the LLMProvider interface for Ollama.
 * It handles communication with the Ollama API to retrieve models and generate responses.
 */
export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private models: Array<{ name: string; supportsImages: boolean }> = [];
  private modelsInitialized: Promise<void>;

  /**
   * Constructor for OllamaProvider
   * 
   * @param baseUrl - The base URL for the Ollama API. Defaults to 'http://localhost:11434'.
   */
  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.modelsInitialized = this.initializeModels();
  }

  async initialize(): Promise<void> {
    await this.modelsInitialized;
  }

  private async initializeModels() {
    try {
      this.models = await this.getModels();
    } catch (error) {
      console.error('Failed to initialize models:', error);
    }
  }

  /**
   * Retrieves the list of available models from the Ollama API.
   * 
   * @returns A promise that resolves to an array of strings, where each string
   *          represents the name of an available model.
   * @throws Will throw an error if the API request fails.
   */

async getModels(): Promise<Array<{ name: string; supportsImages: boolean }>> {
  try {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    
    console.log('Ollama API response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Ollama API response data:', data);

    if (!data.models || !Array.isArray(data.models)) {
      throw new Error('Invalid data format: "models" array is missing.');
    }

    const models = data.models.map((model: any) => ({
      name: model.name,
      supportsImages: model.details && 
                      model.details.families && 
                      model.details.families.includes('clip')
    }));

    console.log('Processed Ollama models:', models);
    return models;
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
}
  
async supportsImages(model: string): Promise<boolean> {
  await this.modelsInitialized;
  return this.models.some(m => m.name === model && m.supportsImages);
}

  /**
   * Generates a response using the specified Ollama model based on the given prompt.
   * 
   * @param prompt - The input text or question to be processed by the model.
   * @param model - The name or identifier of the specific Ollama model to use for generation.
   * @returns A promise that resolves to a string containing the generated response.
   * @throws Will throw an error if the model invocation fails.
   */
  async generateResponse(prompt: string, model: string): Promise<string> {
    try {
      const ollama = new ChatOllama({
        baseUrl: this.baseUrl,
        model: model,
      });
      const response = await ollama.invoke(prompt);
      return response.content as string;
    } catch (error) {
      console.error('Error in OllamaProvider.generateResponse:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  async generateResponseWithImage(prompt: string, model: string, base64Image: string): Promise<string> {
    const supportsImages = await this.supportsImages(model);
    if (!supportsImages) {
      throw new Error(`Model ${model} does not support image inputs.`);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          images: [base64Image],
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read response stream');
      }

      let fullResponse = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              fullResponse += data.response;
            }
          } catch (parseError) {
            console.error('Error parsing JSON chunk:', parseError);
          }
        }
      }

      return fullResponse.trim();
    } catch (error) {
      console.error('Error in OllamaProvider.generateResponseWithImage:', error);
      throw new Error(`Failed to generate response with image: ${error.message}`);
    }
  }
}
