import { NextResponse } from 'next/server';
import { LLMFactory } from '../../../lib/llm/llm-factory';
import { fileToBase64 } from '../../../utils/fileUtils'; 


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
      pm.models.map(model => ({
        provider: pm.provider,
        model,
        supportedInputs: ['text'], // Added supportedInputs here
      }))
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
    console.log('POST request received');
    const formData = await request.formData();
    
    const prompt = formData.get('prompt') as string;
    const providerName = formData.get('provider') as string;
    const modelName = formData.get('model') as string;
    const imageFile = formData.get('image') as File | Blob | null;

    console.log('Extracted data:', { prompt, providerName, modelName, imageFile });

    const provider = LLMFactory.getProvider(providerName);
    console.log('Provider created:', provider);

    let response: string;

    if (imageFile) {
      if (!provider.supportsImages(modelName)) {
        throw new Error('Model does not support image queries');
      }
      const base64Image = await fileToBase64(imageFile);
      console.log('Image converted to base64');
      response = await provider.generateResponseWithImage(prompt, modelName, base64Image);
    } else {
      response = await provider.generateResponse(prompt, modelName);
    }

    console.log('Response generated:', response);

    return NextResponse.json({ result: response });
  } catch (error) {
    console.error('Error in POST /api/generate:', error);
    return NextResponse.json({ error: 'An error occurred while generating the response.' }, { status: 500 });
  }
}