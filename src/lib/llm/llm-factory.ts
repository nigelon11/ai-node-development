import { LLMProvider } from './llm-provider-interface';
import { OllamaProvider } from './ollama-provider';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';

export class LLMFactory {
  static getProvider(providerName: string): LLMProvider {
    switch (providerName) {
      case 'Open-source':
        return new OllamaProvider();
      case 'OpenAI':
        return new OpenAIProvider();
      case 'Anthropic':
        return new AnthropicProvider();
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }
  }
}
