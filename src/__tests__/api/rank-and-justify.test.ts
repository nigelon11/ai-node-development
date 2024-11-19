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

  test('should process the request and return the aggregated score and justification', async () => {
    // Mock responses for each model
    const mockOpenAIResponse =
      'SCORE: 400000, 300000, 200000, 100000\nJUSTIFICATION: OpenAI model justification.';
    const mockAnthropicResponse =
      'SCORE: 350000, 250000, 200000, 200000\nJUSTIFICATION: Anthropic model justification.';
    const mockOllamaResponse =
      'SCORE: 300000, 300000, 200000, 200000\nJUSTIFICATION: Ollama model justification.';
    const mockJustifierResponse = 'Aggregated justification based on all models.';

    // Mock LLMProvider instances
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
      supportsAttachments: jest.fn().mockResolvedValue(false),
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

    // Mock LLMFactory.getProvider to return the mocked providers
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

    // Prepare the request body without an image
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

    // Create a mock NextRequest
    const request = new Request('http://localhost/api/rank-and-justify', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Call the POST handler
    const response = await POST(request);

    // Log the response for debugging
    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('Response type:', typeof response);
    console.log('Response properties:', Object.keys(response));

    // Check if response is defined
    expect(response).toBeDefined();

    // Parse the response
    const data = await response.json();

    // Assertions
    expect(response.status).toBeDefined();
    expect(typeof response.status).toBe('number');
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    expect(data).toHaveProperty('aggregatedScore');
    expect(data).toHaveProperty('justification');

    const expectedAggregatedScore = [
      Math.floor(400000 * 0.5 + 350000 * 0.3 + 300000 * 0.2),
      Math.floor(300000 * 0.5 + 250000 * 0.3 + 300000 * 0.2),
      Math.floor(200000 * 0.5 + 200000 * 0.3 + 200000 * 0.2),
      Math.floor(100000 * 0.5 + 200000 * 0.3 + 200000 * 0.2),
    ];

    expect(data.aggregatedScore).toEqual(expectedAggregatedScore);
    expect(data.justification).toBe(mockJustifierResponse);

    // Ensure that the generateResponse method was called correctly for each model
    expect(mockOpenAIProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining(requestBody.prompt),
      'gpt-4o'
    );

    expect(mockAnthropicProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining(requestBody.prompt),
      'claude-3-sonnet-20240229'
    );

    expect(mockOllamaProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining(requestBody.prompt),
      'phi3'
    );

    // Ensure that generateResponseWithImage and generateResponseWithAttachments were NOT called
    expect(mockOpenAIProvider.generateResponseWithImage).not.toHaveBeenCalled();
    expect(mockOpenAIProvider.generateResponseWithAttachments).not.toHaveBeenCalled();
    expect(mockAnthropicProvider.generateResponseWithImage).not.toHaveBeenCalled();
    expect(mockAnthropicProvider.generateResponseWithAttachments).not.toHaveBeenCalled();
    expect(mockOllamaProvider.generateResponseWithImage).not.toHaveBeenCalled();
    expect(mockOllamaProvider.generateResponseWithAttachments).not.toHaveBeenCalled();

    // Ensure that the JustifierProvider was called with the right arguments
    const [justifierProvider, justifierModel] = process.env.JUSTIFIER_MODEL?.split(':') || ['JustifierProvider', 'default-model'];
    expect(LLMFactory.getProvider).toHaveBeenCalledWith(justifierProvider);
    expect(mockJustifierProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining('aggregated decision vector'),
      justifierModel
    );
  });

  test('should process the request with count parameter for OpenAI model', async () => {
    // Mock responses for each model
    const mockOpenAIResponse1 =
      'SCORE: 400000, 300000, 200000, 100000\nJUSTIFICATION: OpenAI model justification 1.';
    const mockOpenAIResponse2 =
      'SCORE: 410000, 310000, 210000, 110000\nJUSTIFICATION: OpenAI model justification 2.';
    const mockAnthropicResponse =
      'SCORE: 350000, 250000, 200000, 200000\nJUSTIFICATION: Anthropic model justification.';
    const mockOllamaResponse =
      'SCORE: 300000, 300000, 200000, 200000\nJUSTIFICATION: Ollama model justification.';
    const mockJustifierResponse = 'Aggregated justification based on all models.';

    // Mock LLMProvider instances
    const mockOpenAIProvider = {
      generateResponse: jest.fn()
        .mockResolvedValueOnce(mockOpenAIResponse1)
        .mockResolvedValueOnce(mockOpenAIResponse2),
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
      supportsAttachments: jest.fn().mockResolvedValue(false),
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

    // Mock LLMFactory.getProvider to return the mocked providers
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

    // Prepare the request body with count parameter for OpenAI
    const requestBody = {
      prompt: 'Should we expand into the new market?',
      iterations: 1,
      models: [
        {
          provider: 'OpenAI',
          model: 'gpt-4o',
          weight: 0.5,
          count: 2,
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

    // Create a mock NextRequest
    const request = new Request('http://localhost/api/rank-and-justify', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Call the POST handler
    const response = await POST(request);

    // Check if response is defined
    expect(response).toBeDefined();

    // Parse the response
    const data = await response.json();

    // Assertions
    expect(response.status).toBeDefined();
    expect(typeof response.status).toBe('number');
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    expect(data).toHaveProperty('aggregatedScore');
    expect(data).toHaveProperty('justification');

    const expectedAggregatedScore = [
      Math.floor(((400000 + 410000) / 2) * 0.5 + 350000 * 0.3 + 300000 * 0.2),
      Math.floor(((300000 + 310000) / 2) * 0.5 + 250000 * 0.3 + 300000 * 0.2),
      Math.floor(((200000 + 210000) / 2) * 0.5 + 200000 * 0.3 + 200000 * 0.2),
      Math.floor(((100000 + 110000) / 2) * 0.5 + 200000 * 0.3 + 200000 * 0.2),
    ];

    expect(data.aggregatedScore).toEqual(expectedAggregatedScore);
    expect(data.justification).toBe(mockJustifierResponse);

    // Ensure that the generateResponse method was called correctly for each model
    expect(mockOpenAIProvider.generateResponse).toHaveBeenCalledTimes(2);
    expect(mockOpenAIProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining(requestBody.prompt),
      'gpt-4o'
    );

    expect(mockAnthropicProvider.generateResponse).toHaveBeenCalledTimes(1);
    expect(mockAnthropicProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining(requestBody.prompt),
      'claude-3-sonnet-20240229'
    );

    expect(mockOllamaProvider.generateResponse).toHaveBeenCalledTimes(1);
    expect(mockOllamaProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining(requestBody.prompt),
      'phi3'
    );

    // Ensure that generateResponseWithImage and generateResponseWithAttachments were NOT called
    expect(mockOpenAIProvider.generateResponseWithImage).not.toHaveBeenCalled();
    expect(mockOpenAIProvider.generateResponseWithAttachments).not.toHaveBeenCalled();
    expect(mockAnthropicProvider.generateResponseWithImage).not.toHaveBeenCalled();
    expect(mockAnthropicProvider.generateResponseWithAttachments).not.toHaveBeenCalled();
    expect(mockOllamaProvider.generateResponseWithImage).not.toHaveBeenCalled();
    expect(mockOllamaProvider.generateResponseWithAttachments).not.toHaveBeenCalled();

    // Ensure that the JustifierProvider was called with the right arguments
    const [justifierProvider, justifierModel] = process.env.JUSTIFIER_MODEL?.split(':') || ['JustifierProvider', 'default-model'];
    expect(LLMFactory.getProvider).toHaveBeenCalledWith(justifierProvider);
    expect(mockJustifierProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining('aggregated decision vector'),
      justifierModel
    );
  });

  test('should process the request with multiple iterations', async () => {
    // Mock responses for each model
    const mockOpenAIResponses = [
      'SCORE: 400000, 300000, 200000, 100000\nJUSTIFICATION: OpenAI model justification 1.',
      'SCORE: 410000, 310000, 210000, 110000\nJUSTIFICATION: OpenAI model justification 2.',
    ];
    const mockAnthropicResponses = [
      'SCORE: 350000, 250000, 200000, 200000\nJUSTIFICATION: Anthropic model justification 1.',
      'SCORE: 360000, 260000, 210000, 210000\nJUSTIFICATION: Anthropic model justification 2.',
    ];
    const mockOllamaResponses = [
      'SCORE: 300000, 300000, 200000, 200000\nJUSTIFICATION: Ollama model justification 1.',
      'SCORE: 310000, 310000, 210000, 210000\nJUSTIFICATION: Ollama model justification 2.',
    ];
    const mockJustifierResponse = 'Aggregated justification based on all models and iterations.';

    // Mock LLMProvider instances
    const mockOpenAIProvider = {
      generateResponse: jest.fn()
        .mockResolvedValueOnce(mockOpenAIResponses[0])
        .mockResolvedValueOnce(mockOpenAIResponses[1]),
      generateResponseWithImage: jest.fn(),
      generateResponseWithAttachments: jest.fn(),
      supportsImages: jest.fn().mockResolvedValue(true),
      supportsAttachments: jest.fn().mockResolvedValue(true),
    };

    const mockAnthropicProvider = {
      generateResponse: jest.fn()
        .mockResolvedValueOnce(mockAnthropicResponses[0])
        .mockResolvedValueOnce(mockAnthropicResponses[1]),
      generateResponseWithImage: jest.fn(),
      generateResponseWithAttachments: jest.fn(),
      supportsImages: jest.fn().mockResolvedValue(true),
      supportsAttachments: jest.fn().mockResolvedValue(false),
    };

    const mockOllamaProvider = {
      generateResponse: jest.fn()
        .mockResolvedValueOnce(mockOllamaResponses[0])
        .mockResolvedValueOnce(mockOllamaResponses[1]),
      generateResponseWithImage: jest.fn(),
      generateResponseWithAttachments: jest.fn(),
      supportsImages: jest.fn().mockResolvedValue(false),
      supportsAttachments: jest.fn().mockResolvedValue(false),
    };

    const mockJustifierProvider = {
      generateResponse: jest.fn().mockResolvedValue(mockJustifierResponse),
    };

    // Mock LLMFactory.getProvider to return the mocked providers
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

    // Prepare the request body with iterations = 2
    const requestBody = {
      prompt: 'Should we expand into the new market?',
      iterations: 2,
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

    // Create a mock NextRequest
    const request = new Request('http://localhost/api/rank-and-justify', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Call the POST handler
    const response = await POST(request);

    // Check if response is defined
    expect(response).toBeDefined();

    // Parse the response
    const data = await response.json();

    // Assertions
    expect(response.status).toBeDefined();
    expect(typeof response.status).toBe('number');
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    expect(data).toHaveProperty('aggregatedScore');
    expect(data).toHaveProperty('justification');

    const expectedAggregatedScore = [
      Math.floor(((400000 + 410000) / 2) * 0.5 + ((350000 + 360000) / 2) * 0.3 + ((300000 + 310000) / 2) * 0.2),
      Math.floor(((300000 + 310000) / 2) * 0.5 + ((250000 + 260000) / 2) * 0.3 + ((300000 + 310000) / 2) * 0.2),
      Math.floor(((200000 + 210000) / 2) * 0.5 + ((200000 + 210000) / 2) * 0.3 + ((200000 + 210000) / 2) * 0.2),
      Math.floor(((100000 + 110000) / 2) * 0.5 + ((200000 + 210000) / 2) * 0.3 + ((200000 + 210000) / 2) * 0.2),
    ];

    expect(data.aggregatedScore).toEqual(expectedAggregatedScore);
    expect(data.justification).toBe(mockJustifierResponse);

    // Ensure that the generateResponse method was called correctly for each model
    expect(mockOpenAIProvider.generateResponse).toHaveBeenCalledTimes(2);
    expect(mockOpenAIProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining(requestBody.prompt),
      'gpt-4o'
    );

    expect(mockAnthropicProvider.generateResponse).toHaveBeenCalledTimes(2);
    expect(mockAnthropicProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining(requestBody.prompt),
      'claude-3-sonnet-20240229'
    );

    expect(mockOllamaProvider.generateResponse).toHaveBeenCalledTimes(2);
    expect(mockOllamaProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining(requestBody.prompt),
      'phi3'
    );

    // Ensure that generateResponseWithImage and generateResponseWithAttachments were NOT called
    expect(mockOpenAIProvider.generateResponseWithImage).not.toHaveBeenCalled();
    expect(mockOpenAIProvider.generateResponseWithAttachments).not.toHaveBeenCalled();
    expect(mockAnthropicProvider.generateResponseWithImage).not.toHaveBeenCalled();
    expect(mockAnthropicProvider.generateResponseWithAttachments).not.toHaveBeenCalled();
    expect(mockOllamaProvider.generateResponseWithImage).not.toHaveBeenCalled();
    expect(mockOllamaProvider.generateResponseWithAttachments).not.toHaveBeenCalled();

    // Ensure that the JustifierProvider was called with the right arguments
    const [justifierProvider, justifierModel] = process.env.JUSTIFIER_MODEL?.split(':') || ['JustifierProvider', 'default-model'];
    expect(LLMFactory.getProvider).toHaveBeenCalledWith(justifierProvider);
    expect(mockJustifierProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining('aggregated decision vector'),
      justifierModel
    );
  });

  test('generateJustification should return a valid justification', async () => {
    const mockJustifierResponse = 'This is a mock justification.';
    const mockJustifierProvider = {
      generateResponse: jest.fn().mockResolvedValue(mockJustifierResponse),
    };

    const V_total = [400000, 300000, 200000, 100000];
    const allJustifications = [
      'Justification 1',
      'Justification 2',
      'Justification 3',
    ];

    const justification = await generateJustification(
      V_total,
      allJustifications,
      mockJustifierProvider,
      'mock-justifier-model'
    );

    expect(justification).toBe(mockJustifierResponse);
    expect(mockJustifierProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining('Using the aggregated decision vector [400000,300000,200000,100000]'),
      'mock-justifier-model'
    );
    expect(mockJustifierProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining('Justification 1'),
      'mock-justifier-model'
    );
    expect(mockJustifierProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining('Justification 2'),
      'mock-justifier-model'
    );
    expect(mockJustifierProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining('Justification 3'),
      'mock-justifier-model'
    );
  });
});