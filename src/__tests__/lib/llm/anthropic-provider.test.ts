import '@anthropic-ai/sdk/shims/node';
import { AnthropicProvider } from '../../../lib/llm/anthropic-provider';
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from '@langchain/core/messages';
import { modelConfig } from '../../../config/models';

jest.mock("@langchain/anthropic", () => ({
  ChatAnthropic: jest.fn().mockImplementation(() => ({
    invoke: jest.fn(),
  })),
}));

jest.mock('../../../config/models', () => ({
  modelConfig: {
    anthropic: [
      { name: 'claude-2.1', supportsImages: false },
      { name: 'claude-3-sonnet-20240229', supportsImages: true },
    ],
  },
}));

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new AnthropicProvider('test-anthropic-api-key');
  });

  test('getModels returns expected models', async () => {
    const models = await provider.getModels();
    expect(models).toEqual(modelConfig.anthropic);
  });

  test('supportsImages returns correct values', () => {
    expect(provider.supportsImages('claude-2.1')).toBe(false);
    expect(provider.supportsImages('claude-3-sonnet-20240229')).toBe(true);
    expect(provider.supportsImages('non-existent-model')).toBe(false);
  });

  test('generateResponse returns expected response', async () => {
    const mockInvoke = jest.fn().mockResolvedValue({ content: 'Mocked Anthropic response' });
    (ChatAnthropic as jest.Mock).mockImplementation(() => ({
      invoke: mockInvoke,
    }));

    const response = await provider.generateResponse('Test prompt', 'claude-2.1');

    expect(response).toBe('Mocked Anthropic response');
    expect(ChatAnthropic).toHaveBeenCalledWith({
      anthropicApiKey: 'test-anthropic-api-key',
      modelName: 'claude-2.1',
    });
    expect(mockInvoke).toHaveBeenCalledWith('Test prompt');
  });

  test('generateResponseWithImage returns expected response', async () => {
    const mockInvoke = jest.fn().mockResolvedValue({ content: 'Mocked image response' });
    (ChatAnthropic as jest.Mock).mockImplementation(() => ({
      invoke: mockInvoke,
    }));

    const response = await provider.generateResponseWithImage(
      'Describe this image',
      'claude-3-sonnet-20240229',
      'base64EncodedImageString'
    );

    expect(response).toBe('Mocked image response');
    expect(ChatAnthropic).toHaveBeenCalledWith({
      anthropicApiKey: 'test-anthropic-api-key',
      modelName: 'claude-3-sonnet-20240229',
    });
    expect(mockInvoke).toHaveBeenCalledWith([
      new HumanMessage({
        content: [
          { type: "text", text: 'Describe this image' },
          {
            type: "image_url",
            image_url: { url: 'data:image/jpeg;base64,base64EncodedImageString' }
          }
        ],
      }),
    ]);
  });

  test('generateResponseWithImage throws error when model does not support images', async () => {
    await expect(provider.generateResponseWithImage(
      'Attempting image prompt',
      'claude-2.1',
      'base64EncodedImageString'
    )).rejects.toThrow('Model claude-2.1 does not support image inputs.');
  });
});

