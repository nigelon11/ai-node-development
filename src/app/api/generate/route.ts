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
          const llmProvider = await LLMFactory.getProvider(provider);
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
        supportedInputs: ['text', ...(model.supportsImages ? ['image'] : [])],
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

    console.log('Extracted data:', { prompt, providerName, modelName });

    if (!prompt || !providerName || !modelName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const provider = await LLMFactory.getProvider(providerName);
    console.log('Provider created:', provider);

    const attachments: Array<{ type: string, content: string }> = [];
    for (const [key, value] of formData.entries()) {
      if (key === 'image' || key.startsWith('file')) {
        const file = value as File;
        const base64Content = await fileToBase64(file);
        const fileType = file.type.split('/')[0]; // Get the type (e.g., 'image', 'text')

        if (fileType === 'image') {
          attachments.push({ type: 'image', content: base64Content });
        } else {
          attachments.push({ type: 'text', content: base64Content });
        }
      }
    }

    let response: string;
    if (attachments.length > 0) {
      const supportsImages = await provider.supportsImages(modelName);
      
      if (supportsImages && attachments.length === 1 && attachments[0].type === 'image') {
        response = await provider.generateResponseWithImage(prompt, modelName, attachments[0].content);
      } else {
        const supportsAttachments = 'supportsAttachments' in provider ? 
          await provider.supportsAttachments(modelName) : 
          false;
        
        if (supportsAttachments) {
          response = await provider.generateResponseWithAttachments(prompt, modelName, attachments);
        } else {
          throw new Error(`Model ${modelName} does not support the provided attachments`);
        }
      }
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