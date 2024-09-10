import { NextResponse } from 'next/server';
import { LLMFactory } from '../../../lib/llm/llm-factory';

// Define the list of supported LLM providers
const PROVIDERS = ['Open-source', 'OpenAI', 'Anthropic'];

/**
 * GET handler for /api/generate
 * Fetches available models from all supported providers
 * @returns {Promise<NextResponse>} JSON response with all available models or an error message
 */
export async function GET() {
  try {
    console.log('GET request received for /api/generate');
    
    const providerModels = await Promise.all(
      PROVIDERS.map(async (provider) => {
        try {
          console.log(`Fetching models for provider: ${provider}`);
          const llmProvider = LLMFactory.getProvider(provider);
          console.log(`Provider instance created for: ${provider}`);
          const models = await llmProvider.getModels();
          console.log(`Models for ${provider}:`, models);
          return { provider, models };
        } catch (error) {
          console.error(`Error fetching models for ${provider}:`, error);
          return { provider, models: [] };
        }
      })
    );

    const allModels = providerModels.flatMap(pm => 
      pm.models.map(model => ({ provider: pm.provider, model }))
    );

    console.log('All available models:', allModels);

    if (allModels.length === 0) {
      throw new Error('No models available from any provider');
    }

    return NextResponse.json({ models: allModels });
  } catch (error) {
    console.error('Error in GET /api/generate:', error);
    return NextResponse.json({ error: 'An error occurred while fetching models.' }, { status: 500 });
  }
}

/**
 * POST handler for /api/generate
 * Generates a response using the specified provider and model
 * @param {Request} request - The incoming request object
 * @returns {Promise<NextResponse>} JSON response with the generated result or an error message
 */
export async function POST(request: Request) {
  try {
    const { prompt, provider, model } = await request.json();

    if (!provider || !model) {
      return NextResponse.json({ error: 'Provider and model must be specified' }, { status: 400 });
    }

    const llmProvider = LLMFactory.getProvider(provider);
    const response = await llmProvider.generateResponse(prompt, model);

    return NextResponse.json({ result: response });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'An error occurred while generating the response.' }, { status: 500 });
  }
}