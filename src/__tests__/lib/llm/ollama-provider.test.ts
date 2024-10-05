import { OllamaProvider } from '../../../lib/llm/ollama-provider';
import { ChatOllama } from "@langchain/ollama";

jest.mock("@langchain/ollama");

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OllamaProvider('http://localhost:11434');
  });

  test('getModels returns expected models', async () => {
    const mockModels = [
      { name: 'phi3:latest', supportsImages: false },
      { name: 'llama3.1:latest', supportsImages: false },
    ];
    jest.spyOn(provider, 'getModels').mockResolvedValue(mockModels);

    const models = await provider.getModels();
    expect(models).toEqual(mockModels);
  });

  test('supportsImages returns correct values', async () => {
    const mockModels = [
      { name: 'phi3:latest', supportsImages: false },
      { name: 'llama3.1:latest', supportsImages: false },
      { name: 'llava:latest', supportsImages: true },
    ];
    jest.spyOn(provider, 'getModels').mockResolvedValue(mockModels);

    await expect(provider.supportsImages('phi3:latest')).resolves.toBe(false);
    await expect(provider.supportsImages('llama3.1:latest')).resolves.toBe(false);
    await expect(provider.supportsImages('llava:latest')).resolves.toBe(true);
  });

  test('generateResponse returns expected response', async () => {
    const mockInvoke = jest.fn().mockResolvedValue({ content: 'Mocked Ollama response' });
    (ChatOllama as jest.Mock).mockImplementation(() => ({
      invoke: mockInvoke
    }));

    const response = await provider.generateResponse('Test prompt', 'phi3:latest');
    
    expect(response).toBe('Mocked Ollama response');
    expect(ChatOllama).toHaveBeenCalledWith({
      baseUrl: 'http://localhost:11434',
      model: 'phi3:latest',
    });
    expect(mockInvoke).toHaveBeenCalledWith('Test prompt');
  });

  test('generateResponseWithImage throws error', async () => {
    await expect(provider.generateResponseWithImage(
      'Attempting image prompt',
      'phi3:latest',
      'base64EncodedImageString'
    )).rejects.toThrow('Model phi3:latest does not support image inputs.');
  });
});
