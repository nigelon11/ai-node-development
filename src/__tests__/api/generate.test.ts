import { NextResponse } from 'next/server';
import { GET } from '../../app/api/generate/route';
import { LLMFactory } from '../../lib/llm/llm-factory';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({ ...data, status: options?.status })),
  },
}));

jest.mock('../../lib/llm/llm-factory', () => ({
  LLMFactory: {
    getProvider: jest.fn(),
  },
}));

describe('/api/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET returns available models', async () => {
    const mockGetModels = jest.fn().mockResolvedValue(['model1', 'model2']);
    (LLMFactory.getProvider as jest.Mock).mockReturnValue({
      getModels: mockGetModels,
    });

    const result = await GET();

    expect(result).toEqual({
      models: [
        { provider: 'Open-source', model: 'model1' },
        { provider: 'Open-source', model: 'model2' },
        { provider: 'OpenAI', model: 'model1' },
        { provider: 'OpenAI', model: 'model2' },
        { provider: 'Anthropic', model: 'model1' },
        { provider: 'Anthropic', model: 'model2' },
      ],
    });
  });

  test('GET handles error and returns error response', async () => {
    (LLMFactory.getProvider as jest.Mock).mockReturnValue({
      getModels: jest.fn().mockResolvedValue([]),
    });

    const result = await GET();

    expect(result).toEqual({
      error: 'An error occurred while fetching models.',
      status: 500,
    });
  });
});
