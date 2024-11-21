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
    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const providerName = formData.get('provider') as string;
    const modelName = formData.get('model') as string;

    console.log('POST request received in generate/route.ts');
    console.log('Request details:', { prompt, providerName, modelName });

    if (!prompt || !providerName || !modelName) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, provider, and model' },
        { status: 400 }
      );
    }

    let response: string;
    const provider = await LLMFactory.getProvider(providerName);
    console.log('Provider created:', providerName);

    // Process attachments
    const attachments: any[] = [];
    console.log('Form data entries:', Array.from(formData.entries()).map(([key, value]) => ({
      key,
      type: value instanceof File ? 'File' : typeof value,
      fileType: value instanceof File ? value.type : 'N/A'
    })));

    for (const [key, value] of formData.entries()) {
      console.log('Processing form entry:', { key, isFile: value instanceof File });
      
      if (value instanceof File) {
        console.log('Processing attachment:', key);
        const file = value;
        const fileType = file.type;
        console.log('File details:', {
          key,
          type: fileType,
          size: file.size,
          name: file.name
        });
        
        if (fileType.startsWith('image/')) {
          const base64Data = await fileToBase64(file);
          console.log('Image processed successfully:', {
            key,
            dataLength: base64Data.length
          });
          
          attachments.push({
            type: 'image',
            content: base64Data.replace(/^data:image\/[^;]+;base64,/, ''),
            mediaType: fileType
          });
          console.log('Added image attachment');
        } else {
          attachments.push({
            type: 'text',
            content: await file.text(),
            mediaType: 'text/plain'
          });
          console.log('Added text attachment');
        }
      }
    }
    console.log('Total attachments:', attachments.length);

    console.log('Processed attachments:', attachments.map(a => ({
      type: a.type,
      contentLength: a.content.length,
      mediaType: a.mediaType
    })));

    if (attachments.length > 0) {
      const supportsImages = await provider.supportsImages(modelName);
      const supportsAttachments = await provider.supportsAttachments(modelName);
      
      console.log('Model supports images:', supportsImages);
      console.log('Model supports attachments:', supportsAttachments);
      
      if (supportsAttachments) {
        console.log('Calling generateResponseWithAttachments');
        response = await provider.generateResponseWithAttachments(prompt, modelName, attachments);
      } else if (supportsImages && attachments.length === 1 && attachments[0].type === 'image') {
        console.log('Calling generateResponseWithImage');
        console.log('Calling generateResponseWithImage with:', {
          promptLength: prompt.length,
          modelName,
          imageContentLength: attachments[0].content.length
        });
        response = await provider.generateResponseWithImage(prompt, modelName, attachments[0].content);
      } else {
        throw new Error(`Model ${modelName} does not support the provided attachments configuration`);
      }
    } else {
      response = await provider.generateResponse(prompt, modelName);
    }

    return NextResponse.json({ result: response });
  } catch (error) {
    console.error('Error in POST /api/generate:', error);
    return NextResponse.json(
      { error: 'An error occurred while generating the response.' },
      { status: 500 }
    );
  }
}