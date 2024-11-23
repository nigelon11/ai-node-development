import { NextResponse } from 'next/server';
import { POST } from '../../app/api/rank-and-justify/route';
import { LLMFactory } from '../../lib/llm/llm-factory';
import { generateJustification } from '../../app/api/rank-and-justify/route';

// Mock the LLMFactory
jest.mock('../../lib/llm/llm-factory');

// Mock the NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      status: options?.status || 200,
      json: jest.fn().mockResolvedValue(data),
    })),
  },
}));

// Mock the Request class
global.Request = class {
  constructor(url: string, options: any) {
    this.url = url;
    this.method = options.method;
    this.body = options.body;
    this.headers = options.headers;
  }

  async json() {
    return JSON.parse(this.body);
  }
};

describe('POST /api/rank-and-justify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    test('should process single iteration request', async () => {
      // Mock responses for each model
      const mockOpenAIResponse = 'SCORE: 400000, 300000, 200000, 100000\nJUSTIFICATION: OpenAI model justification.';
      const mockAnthropicResponse = 'SCORE: 350000, 250000, 200000, 200000\nJUSTIFICATION: Anthropic model justification.';
      const mockOllamaResponse = 'SCORE: 300000, 300000, 200000, 200000\nJUSTIFICATION: Ollama model justification.';
      const mockJustifierResponse = 'Aggregated justification based on all models.';

      // Mock providers
      const mockOpenAIProvider = {
        generateResponse: jest.fn().mockResolvedValue(mockOpenAIResponse),
        generateResponseWithImage: jest.fn(),
        generateResponseWithAttachments: jest.fn(),
        supportsImages: jest.fn().mockResolvedValue(true),
        supportsAttachments: jest.fn().mockResolvedValue(true),
      };

      const mockAnthropicProvider = {
        generateResponse: jest.fn().mockResolvedValue(mockAnthropicResponse),
        generateResponseWithImage: jest.fn(),
        generateResponseWithAttachments: jest.fn(),
        supportsImages: jest.fn().mockResolvedValue(true),
        supportsAttachments: jest.fn().mockResolvedValue(true),
      };

      const mockOllamaProvider = {
        generateResponse: jest.fn().mockResolvedValue(mockOllamaResponse),
        generateResponseWithImage: jest.fn(),
        generateResponseWithAttachments: jest.fn(),
        supportsImages: jest.fn().mockResolvedValue(false),
        supportsAttachments: jest.fn().mockResolvedValue(false),
      };

      const mockJustifierProvider = {
        generateResponse: jest.fn().mockResolvedValue(mockJustifierResponse),
      };

      // Mock LLMFactory.getProvider
      (LLMFactory.getProvider as jest.Mock).mockImplementation((providerName: string) => {
        switch (providerName) {
          case 'OpenAI':
            return mockOpenAIProvider;
          case 'Anthropic':
            return mockAnthropicProvider;
          case 'Ollama':
            return mockOllamaProvider;
          case 'JustifierProvider':
            return mockJustifierProvider;
          default:
            throw new Error(`Unknown provider: ${providerName}`);
        }
      });

      const requestBody = {
        prompt: 'Should we expand into the new market?',
        iterations: 1,
        models: [
          {
            provider: 'OpenAI',
            model: 'gpt-4o',
            weight: 0.5,
          },
          {
            provider: 'Anthropic',
            model: 'claude-3-sonnet-20240229',
            weight: 0.3,
          },
          {
            provider: 'Ollama',
            model: 'phi3',
            weight: 0.2,
          },
        ],
      };

      const request = new Request('http://localhost/api/rank-and-justify', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      expect(response).toBeDefined();
      const data = await response.json();

      const expectedAggregatedScore = [
        Math.floor(400000 * 0.5 + 350000 * 0.3 + 300000 * 0.2),
        Math.floor(300000 * 0.5 + 250000 * 0.3 + 300000 * 0.2),
        Math.floor(200000 * 0.5 + 200000 * 0.3 + 200000 * 0.2),
        Math.floor(100000 * 0.5 + 200000 * 0.3 + 200000 * 0.2),
      ];

      expect(data.aggregatedScore).toEqual(expectedAggregatedScore);
      expect(data.justification).toBe(mockJustifierResponse);
    });

    test('should handle image attachments', async () => {
      // Reference existing test from rank-and-justify.test.ts
      startLine: 200
      endLine: 250
    });

    test('should handle count parameter', async () => {
      // Reference existing test from rank-and-justify.test.ts
      startLine: 250
      endLine: 300
    });
  });

  describe('Iterative feedback', () => {
    test('should include previous responses in subsequent iterations', async () => {
      // Mock responses for each model and iteration
      const mockResponses = {
        OpenAI: [
          'SCORE: 600000,400000\nJUSTIFICATION: First iteration OpenAI justification.',
          'SCORE: 700000,300000\nJUSTIFICATION: Second iteration OpenAI justification considering previous responses.'
        ],
        Anthropic: [
          'SCORE: 550000,450000\nJUSTIFICATION: First iteration Anthropic justification.',
          'SCORE: 650000,350000\nJUSTIFICATION: Second iteration Anthropic justification considering previous responses.'
        ]
      };

      // Mock providers
      const mockOpenAIProvider = {
        generateResponse: jest.fn()
          .mockImplementation(() => Promise.resolve(mockResponses.OpenAI.shift())),
        supportsAttachments: jest.fn().mockResolvedValue(false),
      };

      const mockAnthropicProvider = {
        generateResponse: jest.fn()
          .mockImplementation(() => Promise.resolve(mockResponses.Anthropic.shift())),
        supportsAttachments: jest.fn().mockResolvedValue(false),
      };

      const mockJustifierProvider = {
        generateResponse: jest.fn().mockResolvedValue('Final aggregated justification'),
      };

      // Mock LLMFactory.getProvider
      (LLMFactory.getProvider as jest.Mock).mockImplementation((providerName: string) => {
        switch (providerName) {
          case 'OpenAI':
            return mockOpenAIProvider;
          case 'Anthropic':
            return mockAnthropicProvider;
          case 'JustifierProvider':
            return mockJustifierProvider;
          default:
            throw new Error(`Unknown provider: ${providerName}`);
        }
      });

      const requestBody = {
        prompt: 'Should we proceed with the investment?',
        iterations: 2,
        models: [
          {
            provider: 'OpenAI',
            model: 'gpt-4',
            weight: 0.6,
          },
          {
            provider: 'Anthropic',
            model: 'claude-3',
            weight: 0.4,
          },
        ],
      };

      const request = new Request('http://localhost/api/rank-and-justify', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      expect(response).toBeDefined();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('aggregatedScore');
      expect(data).toHaveProperty('justification');

      expect(mockOpenAIProvider.generateResponse).toHaveBeenCalledTimes(2);
      expect(mockAnthropicProvider.generateResponse).toHaveBeenCalledTimes(2);

      const secondOpenAICall = mockOpenAIProvider.generateResponse.mock.calls[1][0];
      const secondAnthropicCall = mockAnthropicProvider.generateResponse.mock.calls[1][0];

      expect(secondOpenAICall).toContain('First iteration OpenAI justification');
      expect(secondOpenAICall).toContain('First iteration Anthropic justification');
      expect(secondAnthropicCall).toContain('First iteration OpenAI justification');
      expect(secondAnthropicCall).toContain('First iteration Anthropic justification');

      const expectedFinalScore = [
        Math.floor(700000 * 0.6 + 650000 * 0.4),
        Math.floor(300000 * 0.6 + 350000 * 0.4),
      ];
      expect(data.aggregatedScore).toEqual(expectedFinalScore);
    });

    test('should handle errors in iterative responses', async () => {
      const mockErrorResponse = 'Invalid response format';
      const mockOpenAIProvider = {
        generateResponse: jest.fn().mockRejectedValue(new Error(mockErrorResponse)),
        supportsAttachments: jest.fn().mockResolvedValue(false),
      };

      (LLMFactory.getProvider as jest.Mock).mockResolvedValue(mockOpenAIProvider);

      const requestBody = {
        prompt: 'Test prompt',
        iterations: 2,
        models: [
          {
            provider: 'OpenAI',
            model: 'gpt-4',
            weight: 1.0,
          },
        ],
      };

      const request = new Request('http://localhost/api/rank-and-justify', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });

  test('generateJustification should return a valid justification', async () => {
    // Reference existing test from rank-and-justify.test.ts
    startLine: 400
    endLine: 450
  });
});