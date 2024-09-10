import { OpenAIProvider } from '../../../lib/llm/openai-provider';
import { ChatOpenAI } from "@langchain/openai";

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'Mocked response' }),
  })),
}));

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenAIProvider('test-api-key');
  });

  test('getModels returns expected models', async () => {
    const models = await provider.getModels();
    expect(models).toEqual(['gpt-3.5-turbo', 'gpt-4']);
  });

  test('generateResponse returns expected response', async () => {
    const response = await provider.generateResponse('Test prompt', 'gpt-3.5-turbo');
    expect(response).toBe('Mocked response');
  });
});
