import { NextResponse } from 'next/server';
import { LLMFactory } from '@/lib/llm/llm-factory';

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
    
    // Fetch models from all providers concurrently
    const providerModels = await Promise.all(
      PROVIDERS.map(async (provider) => {
        try {
          console.log(`Fetching models for provider: ${provider}`);
          // Get the appropriate LLM provider instance
          const llmProvider = LLMFactory.getProvider(provider);
          console.log(`Provider instance created for: ${provider}`);
          // Fetch models for the current provider
          const models = await llmProvider.getModels();
          console.log(`Models for ${provider}:`, models);
          return { provider, models };
        } catch (error) {
          console.error(`Error fetching models for ${provider}:`, error);
          // Return an empty array of models if there's an error
          return { provider, models: [] };
        }
      })
    );

    // Flatten the array of provider models into a single array
    const allModels = providerModels.flatMap(pm => 
      pm.models.map(model => ({ provider: pm.provider, model }))
    );

    console.log('All available models:', allModels);

    // Return the list of all available models as a JSON response
    return NextResponse.json({ models: allModels });
  } catch (error) {
    console.error('Error in GET /api/generate:', error);
    // Return an error response if something goes wrong
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
    // Extract prompt, provider, and model from the request body
    const { prompt, provider, model } = await request.json();

    // Validate that provider and model are specified
    if (!provider || !model) {
      return NextResponse.json({ error: 'Provider and model must be specified' }, { status: 400 });
    }

    // Get the appropriate LLM provider instance
    const llmProvider = LLMFactory.getProvider(provider);
    // Generate a response using the specified prompt and model
    const response = await llmProvider.generateResponse(prompt, model);

    // Return the generated response as a JSON object
    return NextResponse.json({ result: response });
  } catch (error) {
    console.error('Error:', error);
    // Return an error response if something goes wrong
    return NextResponse.json({ error: 'An error occurred while generating the response.' }, { status: 500 });
  }
}