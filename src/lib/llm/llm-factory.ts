import { LLMProvider } from './llm-provider-interface';
import { OllamaProvider } from './ollama-provider';
import { OpenAIProvider } from './openai-provider';
import { ClaudeProvider } from './claude-provider';

export class LLMFactory {
  static getProvider(providerName: string): LLMProvider {
    switch (providerName) {
      case 'Open-source':
        return new OllamaProvider();
      case 'OpenAI':
        return new OpenAIProvider();
      case 'Anthropic':
        return new ClaudeProvider();
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }
  }
}
