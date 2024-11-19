import { OpenAIProvider } from '../../../lib/llm/openai-provider';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from '@langchain/core/messages';

import OpenAI from 'openai';

// Mock the OpenAI class directly without a separate MockOpenAI class
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked response' } }]
        })
      }
    }
  })
}));

jest.mock("@langchain/openai");

import { modelConfig } from '../../../config/models';

jest.mock('../../../config/models', () => ({
  modelConfig: {
    openai: [
      { name: 'gpt-3.5-turbo', supportsImages: false },
      { name: 'gpt-4', supportsImages: false },
      { name: 'gpt-4o', supportsImages: true },
    ],
  },
}));

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenAIProvider('test-api-key');
  });

  test('getModels returns expected models', async () => {
    const models = await provider.getModels();
    expect(models).toEqual(modelConfig.openai);
  });

  test('supportsImages returns correct values', () => {
    expect(provider.supportsImages('gpt-3.5-turbo')).toBe(false);
    expect(provider.supportsImages('gpt-4')).toBe(false);
    expect(provider.supportsImages('gpt-4o')).toBe(true);
    expect(provider.supportsImages('non-existent-model')).toBe(false);
  });

  test('generateResponse returns expected response', async () => {
    const mockInvoke = jest.fn().mockResolvedValue({ content: 'Mocked response' });
    (ChatOpenAI as jest.Mock).mockImplementation(() => ({
      invoke: mockInvoke
    }));

    const response = await provider.generateResponse('Test prompt', 'gpt-3.5-turbo');
    
    expect(response).toBe('Mocked response');
    expect(ChatOpenAI).toHaveBeenCalledWith({
      openAIApiKey: 'test-api-key',
      modelName: 'gpt-3.5-turbo',
    });
    expect(mockInvoke).toHaveBeenCalledWith('Test prompt');
  });

  test('generateResponseWithImage returns expected response', async () => {
    const mockInvoke = jest.fn().mockResolvedValue({ content: 'Mocked image response' });
    (ChatOpenAI as jest.Mock).mockImplementation(() => ({
      invoke: mockInvoke
    }));

    const response = await provider.generateResponseWithImage(
      'Describe this image',
      'gpt-4o',
      'base64EncodedImageString'
    );

    expect(response).toBe('Mocked image response');
    expect(ChatOpenAI).toHaveBeenCalledWith({
      openAIApiKey: 'test-api-key',
      modelName: 'gpt-4o',
    });
    expect(mockInvoke).toHaveBeenCalledWith([
      new HumanMessage({
        content: [
          { type: "text", text: 'Describe this image' },
          {
            type: "image_url",
            image_url: { url: 'data:image/jpeg;base64,base64EncodedImageString' }
          }
        ]
      })
    ]);
  });

  test('generateResponseWithAttachments returns expected response', async () => {
    const mockInvoke = jest.fn().mockResolvedValue({ content: 'Mocked response with attachments' });
    (ChatOpenAI as jest.Mock).mockImplementation(() => ({
      invoke: mockInvoke
    }));

    const attachments = [
      { type: 'text', content: 'Additional text' },
      { type: 'image', content: 'base64EncodedImageString' }
    ];

    const response = await provider.generateResponseWithAttachments(
      'Test prompt with attachments',
      'gpt-3.5-turbo',
      attachments
    );

    expect(response).toBe('Mocked response with attachments');
    expect(ChatOpenAI).toHaveBeenCalledWith({
      openAIApiKey: 'test-api-key',
      modelName: 'gpt-3.5-turbo',
    });
    expect(mockInvoke).toHaveBeenCalledWith([
      new HumanMessage({
        content: [
          { type: "text", text: 'Test prompt with attachments' },
          { type: "text", text: 'Additional text' },
          {
            type: "image_url",
            image_url: { url: 'data:image/jpeg;base64,base64EncodedImageString' }
          }
        ]
      })
    ]);
  });
});
