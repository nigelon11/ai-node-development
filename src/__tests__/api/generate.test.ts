// src/__tests__/api/generate.test.ts

// Polyfill TextEncoder for Node.js
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// 1. Mock Dependencies Before Importing Modules That Use Them

// Mock the LLMFactory module
jest.mock('../../lib/llm/llm-factory');

// Mock the fileToBase64 function from fileUtils
jest.mock('../../utils/fileUtils', () => ({
  fileToBase64: jest.fn(),
}));

// Mock the NextResponse from 'next/server'
jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: jest.fn((data: any) => ({
        json: jest.fn().mockResolvedValue(data),
      })),
    },
  };
});

// 2. Import Modules After Mocks Have Been Defined

import { GET, POST } from '../../app/api/generate/route';
import { LLMFactory } from '../../lib/llm/llm-factory';
import * as fileUtils from '../../utils/fileUtils';
import { NextResponse } from 'next/server';
import { FormData, File } from 'formdata-node';
import { FormDataEncoder } from 'form-data-encoder';
import { Readable } from 'stream';
import { Request as NodeFetchRequest } from 'node-fetch';


describe('/api/generate', () => {
  beforeEach(() => {
    // Clear all mocks before each test to ensure test isolation
    jest.clearAllMocks();
  });

  /**
   * Test 1: GET returns available models with supported inputs
   */
  test('GET returns available models with supported inputs', async () => {
    // Mock implementations for each provider's getModels method
    const mockOpenAIGetModels = jest.fn().mockResolvedValue([
      { name: 'gpt-3.5-turbo', supportsImages: false },
      { name: 'gpt-4', supportsImages: false },
      { name: 'gpt-4o', supportsImages: true },
    ]);

    const mockOpenSourceGetModels = jest.fn().mockResolvedValue([
      { name: 'phi3', supportsImages: false },
      { name: 'llama3.1', supportsImages: false },
    ]);

    const mockAnthropicGetModels = jest.fn().mockResolvedValue([
      { name: 'claude-2', supportsImages: false },
      { name: 'claude-3-sonnet-20240229', supportsImages: true },
    ]);

    // Mock the LLMFactory.getProvider to return different providers based on input
    (LLMFactory.getProvider as jest.Mock).mockImplementation((providerName: string) => {
      switch (providerName) {
        case 'OpenAI':
          return { getModels: mockOpenAIGetModels };
        case 'Open-source':
          return { getModels: mockOpenSourceGetModels };
        case 'Anthropic':
          return { getModels: mockAnthropicGetModels };
        default:
          throw new Error(`Unknown provider: ${providerName}`);
      }
    });

    // Execute the GET function
    const response = await GET();
    const result = await response.json();

    // Define the expected result based on mocked data
    const expectedModels = [
      // Open-source models
      {
        provider: 'Open-source',
        model: { name: 'phi3', supportsImages: false },
        supportedInputs: ['text'],
      },
      {
        provider: 'Open-source',
        model: { name: 'llama3.1', supportsImages: false },
        supportedInputs: ['text'],
      },
      // OpenAI models
      {
        provider: 'OpenAI',
        model: { name: 'gpt-3.5-turbo', supportsImages: false },
        supportedInputs: ['text'],
      },
      {
        provider: 'OpenAI',
        model: { name: 'gpt-4', supportsImages: false },
        supportedInputs: ['text'],
      },
      {
        provider: 'OpenAI',
        model: { name: 'gpt-4o', supportsImages: true },
        supportedInputs: ['text'],
      },
      // Anthropic models
      {
        provider: 'Anthropic',
        model: { name: 'claude-2', supportsImages: false },
        supportedInputs: ['text'],
      },
      {
        provider: 'Anthropic',
        model: { name: 'claude-3-sonnet-20240229', supportsImages: true },
        supportedInputs: ['text'],
      },
    ];

    // Assert that the result matches the expected structure
    expect(result).toEqual({
      models: expectedModels,
    });

    // Verify that all provider mocks were called
    expect(mockOpenAIGetModels).toHaveBeenCalled();
    expect(mockOpenSourceGetModels).toHaveBeenCalled();
    expect(mockAnthropicGetModels).toHaveBeenCalled();
  });

  /**
   * Test 2: GET handles error and returns error response when no models are available
   */
  test('GET handles error and returns error response when no models are available', async () => {
    // Mock all providers to return empty arrays
    const mockOpenAIGetModels = jest.fn().mockResolvedValue([]);
    const mockOpenSourceGetModels = jest.fn().mockResolvedValue([]);
    const mockAnthropicGetModels = jest.fn().mockResolvedValue([]);

    // Mock the LLMFactory.getProvider
    (LLMFactory.getProvider as jest.Mock).mockImplementation((providerName: string) => {
      switch (providerName) {
        case 'OpenAI':
          return { getModels: mockOpenAIGetModels };
        case 'Open-source':
          return { getModels: mockOpenSourceGetModels };
        case 'Anthropic':
          return { getModels: mockAnthropicGetModels };
        default:
          throw new Error(`Unknown provider: ${providerName}`);
      }
    });

    // Execute the GET function
    const response = await GET();
    const result = await response.json();

    // Define the expected error response
    const expectedError = {
      error: 'An error occurred while fetching models.',
    };

    // Assert that the result matches the expected error structure
    expect(result).toEqual(expectedError);

    // Verify that all provider mocks were called
    expect(mockOpenAIGetModels).toHaveBeenCalled();
    expect(mockOpenSourceGetModels).toHaveBeenCalled();
    expect(mockAnthropicGetModels).toHaveBeenCalled();
  });

  /**
   * Test 3: POST handles image upload and generates response
   */
  test('POST handles image upload and generates response', async () => {
    // Mock the provider
    const mockProvider = {
      supportsImages: jest.fn().mockReturnValue(true),
      generateResponseWithImage: jest.fn().mockResolvedValue('Generated response with image'),
    };
    (LLMFactory.getProvider as jest.Mock).mockReturnValue(mockProvider);

    // Mock fileToBase64
    (fileUtils.fileToBase64 as jest.Mock).mockResolvedValue('base64EncodedImageData');

    // Mock FormData
    const mockFormData = {
      get: jest.fn((key) => {
        switch (key) {
          case 'prompt':
            return 'Describe this image';
          case 'provider':
            return 'OpenAI';
          case 'model':
            return 'gpt-4o';
          case 'image':
            return new Blob(['fake image data'], { type: 'image/jpeg' });
          default:
            return null;
        }
      }),
    };

    // Mock Request
    const mockRequest = {
      formData: jest.fn().mockResolvedValue(mockFormData),
    } as unknown as Request;

    // Mock NextResponse
    (NextResponse.json as jest.Mock).mockImplementation((data) => ({
      json: async () => data,
    }));

    // Execute the POST function
    const response = await POST(mockRequest as unknown as Request);
    const result = await response.json();

    console.log('Mock provider calls:', mockProvider.supportsImages.mock.calls);
  console.log('Mock provider generateResponseWithImage calls:', mockProvider.generateResponseWithImage.mock.calls);
  console.log('fileToBase64 calls:', (fileUtils.fileToBase64 as jest.Mock).mock.calls);
  console.log('NextResponse.json calls:', (NextResponse.json as jest.Mock).mock.calls);

    // Assert the result
    expect(result).toEqual({ result: 'Generated response with image' });

    // Assert that the correct methods were called
    expect(mockProvider.supportsImages).toHaveBeenCalledWith('gpt-4o');
    expect(mockProvider.generateResponseWithImage).toHaveBeenCalledWith(
      'Describe this image',
      'gpt-4o',
      'base64EncodedImageData'
    );
    expect(fileUtils.fileToBase64).toHaveBeenCalled();
  });
});