/**
 * OpenAIProvider Module
 * 
 * This module implements the LLMProvider interface for the OpenAI language model service.
 * It provides functionality to interact with OpenAI models, including fetching available models
 * and generating responses to prompts.
 */

import { LLMProvider } from './llm-provider-interface';
import { ChatOpenAI } from "@langchain/openai";

/**
 * OpenAIProvider class
 * 
 * This class implements the LLMProvider interface for OpenAI.
 * It handles communication with the OpenAI API to retrieve models and generate responses.
 */
export class OpenAIProvider implements LLMProvider {
  private apiKey: string;

  /**
   * Constructor for OpenAIProvider
   * 
   * @param apiKey - The API key for authenticating with OpenAI. Defaults to the OPENAI_API_KEY environment variable.
   */
  constructor(apiKey: string = process.env.OPENAI_API_KEY || '') {
    this.apiKey = apiKey;
  }

  /**
   * Retrieves the list of available models from OpenAI.
   * 
   * @returns A promise that resolves to an array of strings, where each string
   *          represents the name of an available model.
   * @note This is a simplified implementation. In a production environment,
   *       you should fetch the actual list of models from OpenAI's API.
   */
  async getModels(): Promise<string[]> {
    // This is a simplified list. In a real implementation, you'd fetch this from OpenAI's API.
    return ['gpt-3.5-turbo', 'gpt-4'];
  }

  /**
   * Generates a response using the specified OpenAI model based on the given prompt.
   * 
   * @param prompt - The input text or question to be processed by the model.
   * @param model - The name or identifier of the specific OpenAI model to use for generation.
   * @returns A promise that resolves to a string containing the generated response.
   * @throws Will throw an error if the model invocation fails or if the response is not a string.
   */
  async generateResponse(prompt: string, model: string): Promise<string> {
    const openai = new ChatOpenAI({
      openAIApiKey: this.apiKey,
      modelName: model,
    });
    const response = await openai.invoke(prompt);
    if (typeof response.content !== 'string') {
      throw new Error('Unexpected response format from OpenAI');
    }
    return response.content;
  }
}
