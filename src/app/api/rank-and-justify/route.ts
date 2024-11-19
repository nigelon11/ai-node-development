import { NextResponse } from 'next/server';
import { LLMFactory } from '../../../lib/llm/llm-factory';
import { prePromptConfig } from '../../../config/prePromptConfig';

// Load the justifier model name from environment variables
const JUSTIFIER_MODEL = process.env.JUSTIFIER_MODEL || 'default-justifier-model';
const [justifierProviderName, justifierModelName] = process.env.JUSTIFIER_MODEL?.split(':') || ['JustifierProvider', 'default-model'];

interface ModelInput {
  provider: string;
  model: string;
  weight: number;
  count?: number;
}

interface InputData {
  prompt: string;
  image?: string;
  iterations?: number;
  models: ModelInput[];
  attachments?: string[];
}

export async function POST(request: Request) {
  try {
    console.log('POST request received at /api/rank-and-justify');

    const body: InputData = await request.json();

    // Input validation
    if (!body.prompt || !Array.isArray(body.models) || body.models.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input. "prompt" and "models" are required.' },
        { status: 400 }
      );
    }

    const prompt = body.prompt;
    const base64Image = body.image || null;
    const iterations = body.iterations || 1;
    const models = body.models;

    // Initialize data structures
    const modelOutputs: number[][][] = []; // [modelIndex][iteration][outcomeIndex]
    const V_average: number[][] = []; // [modelIndex][outcomeIndex]
    const weights: number[] = [];
    const totalWeights = models.reduce((sum, m) => sum + m.weight, 0);
    const allJustifications: string[] = [];

    // Validate total weights
    if (totalWeights <= 0 || totalWeights > models.length) {
      return NextResponse.json(
        { error: 'Invalid weights assigned to models.' },
        { status: 400 }
      );
    }

    console.log('Starting model invocations');

    // Model Invocation
    for (let j = 0; j < models.length; j++) {
      const modelInfo = models[j];
      const count = modelInfo.count || 1;
      const weight = modelInfo.weight;

      console.log(`Processing model: ${modelInfo.provider} - ${modelInfo.model}`);

      if (!modelInfo.provider || !modelInfo.model || weight < 0 || weight > 1) {
        return NextResponse.json(
          { error: 'Invalid model input. Check provider, model, and weight.' },
          { status: 400 }
        );
      }

      const llmProvider = await LLMFactory.getProvider(modelInfo.provider);
      if (!llmProvider) {
        return NextResponse.json(
          { error: `Unsupported provider: ${modelInfo.provider}` },
          { status: 400 }
        );
      }

      // Adjust the prompt with the pre-prompt
      const fullPrompt = `${prePromptConfig.prompt}\n\n${prompt}`;
      const supportsImages = await llmProvider.supportsImages(modelInfo.model);
      const supportsAttachments = await llmProvider.supportsAttachments(modelInfo.model);

      const allOutputs: number[][] = [];

      for (let i = 0; i < iterations; i++) {
        console.log(`Iteration ${i + 1} for ${modelInfo.provider} - ${modelInfo.model}`);
        for (let c = 0; c < count; c++) {
          let responseText: string;
          if (base64Image && supportsImages) {
            responseText = await llmProvider.generateResponseWithImage(
              fullPrompt,
              modelInfo.model,
              base64Image
            );
          } else if (supportsAttachments && body.attachments) {
            responseText = await llmProvider.generateResponseWithAttachments(
              fullPrompt,
              modelInfo.model,
              body.attachments
            );
          } else {
            responseText = await llmProvider.generateResponse(fullPrompt, modelInfo.model);
          }

          console.log(`Raw response from ${modelInfo.provider} - ${modelInfo.model}:`, responseText);

          // Parse the model response to extract the decision vector
          const { decisionVector, justification } = parseModelResponse(responseText);

          console.log(`Parsed decision vector:`, decisionVector);
          console.log(`Parsed justification:`, justification);

          if (justification) {
            allJustifications.push(`From model ${modelInfo.model}:\n${justification}`);
          }

          if (!decisionVector || !Array.isArray(decisionVector)) {
            console.error(`Failed to parse decision vector from model ${modelInfo.model}`);
            continue; // This will skip the current iteration but not return a response
          }

          allOutputs.push(decisionVector);
        }
      }

      console.log(`All outputs for ${modelInfo.provider} - ${modelInfo.model}:`, allOutputs);

      // Store outputs and weights
      modelOutputs.push(allOutputs);
      weights.push(weight);
    }

    // Aggregation Logic
    // 4. Compute average decision vector for each model
    for (let j = 0; j < models.length; j++) {
      const outputs = modelOutputs[j];
      const count = outputs.length;

      const sumVector = outputs.reduce((acc, vec) => {
        return vec.map((val, idx) => (acc[idx] || 0) + val);
      }, []);

      const avgVector = sumVector.map((val) => val / count);
      V_average.push(avgVector);

      // Logging intermediate results
      console.log(`Average vector for model ${models[j].model}:`, avgVector);
    }

    // 5. Compute composite score for each iteration
    const V_composite: number[][] = [];
    for (let i = 0; i < iterations; i++) {
      const compositeVector = V_average[0].map((_, k) => {
        return V_average.reduce((sum, v_avg, j) => {
          return sum + v_avg[k] * weights[j];
        }, 0);
      });
      V_composite.push(compositeVector);

      // Logging intermediate results
      console.log(`Composite vector for iteration ${i + 1}:`, compositeVector);
    }

    // 6. Compute total decision vector by averaging composite scores
    const V_total = V_composite.reduce((acc, vec) => {
      return vec.map((val, idx) => (acc[idx] || 0) + val);
    }, []).map((val) => val / iterations);

    // Logging the final aggregated score
    console.log('Final aggregated score vector:', V_total);

    // Initialize the justifier provider
    const justifierProvider = await LLMFactory.getProvider(justifierProviderName);
    if (!justifierProvider) {
      return NextResponse.json(
        { error: `Unsupported justifier provider: ${justifierProviderName}` },
        { status: 400 }
      );
    }

    // Generate the final justification
    const justification = await generateJustification(V_total, allJustifications, justifierProvider, justifierModelName);

    // Output Structure
    const responseData = {
      aggregatedScore: V_total,
      justification,
    };
    console.log('Returning response:', JSON.stringify(responseData, null, 2));
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in POST /api/rank-and-justify:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing the request.' },
      { status: 500 }
    );
  }
}

// Helper function to parse the model response
function parseModelResponse(responseText: string): {
  decisionVector: number[] | null;
  justification: string;
} {
  try {
    // Regular expressions to match "SCORE:" and "JUSTIFICATION:"
    const scoreRegex = /SCORE:\s*([0-9,\s]+)/i;
    const justificationRegex = /JUSTIFICATION:\s*(.*)/is;

    const scoreMatch = responseText.match(scoreRegex);
    const justificationMatch = responseText.match(justificationRegex);

    let decisionVector: number[] | null = null;
    if (scoreMatch && scoreMatch[1]) {
      decisionVector = scoreMatch[1]
        .split(',')
        .map((numStr) => parseInt(numStr.trim()))
        .filter((num) => !isNaN(num));
    }

    const justification = justificationMatch
      ? justificationMatch[1].trim()
      : 'No justification provided.';

    return { decisionVector, justification };
  } catch (err) {
    console.error('Error parsing model response:', err);
    return { decisionVector: null, justification: '' };
  }
}

// Helper function to generate justification
export async function generateJustification(
  V_total: number[],
  allJustifications: string[],
  justifierProvider: any,
  justifierModel: string
): Promise<string> {
  const prompt = `Using the aggregated decision vector ${JSON.stringify(
    V_total
  )}, and considering the following justifications from individual models:\n\n${allJustifications.join(
    '\n\n'
  )}\n\nProvide a comprehensive justification for the result.`;

  const response = await justifierProvider.generateResponse(prompt, justifierModel);
  return response;
}