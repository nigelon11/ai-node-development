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

  /**
   * Constructor for OllamaProvider
   * 
   * @param baseUrl - The base URL for the Ollama API. Defaults to 'http://localhost:11434'.
   */
  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  /**
   * Retrieves the list of available models from the Ollama API.
   * 
   * @returns A promise that resolves to an array of strings, where each string
   *          represents the name of an available model.
   * @throws Will throw an error if the API request fails.
   */

async getModels(): Promise<Array<{ name: string; supportsImages: boolean }>> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    
    // Check if the response is successful
    if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Ensure that data.models exists and is an array
    if (!data.models || !Array.isArray(data.models)) {
        throw new Error('Invalid data format: "models" array is missing.');
    }

    // Map each model object to the desired structure
    return data.models.map((model: any) => ({
        name: model.name,
        supportsImages: false
    }));
}
  supportsImages(model: string): boolean {
    return false;
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
    throw new Error('Image input is not supported for this model.');
  }
}
