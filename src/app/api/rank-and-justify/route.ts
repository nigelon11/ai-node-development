import { NextResponse } from 'next/server';
import { LLMFactory } from '../../../lib/llm/llm-factory';
import { prePromptConfig } from '../../../config/prePromptConfig';
import { postPromptConfig } from '../../../config/postPromptConfig';
import fs from 'fs';
import path from 'path';

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

interface LLMProvider {
  generateResponse: (prompt: string, model: string) => Promise<string>;
  generateResponseWithAttachments?: (prompt: string, model: string, attachments: any[]) => Promise<string>;
  supportsAttachments?: boolean;
}

function logInteraction(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Log to console
  console.log(logMessage);

  // Log to file
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'llm-interactions.log');

  try {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(logFile, logMessage);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
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
    const iterations = body.iterations || 1;
    const models = body.models;

    // Process attachments if they exist
    const attachments = body.attachments?.map(content => {
      if (content.startsWith('data:image')) {
        const mediaTypeMatch = content.match(/^data:([^;]+);base64,/);
        const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/jpeg';
        const base64Data = content.replace(/^data:image\/[^;]+;base64,/, '');
        return {
          type: 'image',
          content: base64Data,
          mediaType: mediaType
        };
      }
      return {
        type: 'text',
        content: content,
        mediaType: 'text/plain'
      };
    }) || [];

    // Initialize data structures
    const previousIterationResponses: string[] = [];
    const modelOutputs: number[][][] = [];
    const V_average: number[][] = [];
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

    let finalAggregatedScore: number[] = [];
    let finalJustification: string = '';

    // Model Invocation
    for (let i = 0; i < iterations; i++) {
      console.log(`Starting iteration ${i + 1}`);
      
      const iterationOutputs: number[][] = [];
      const iterationWeights: number[] = [];
      const iterationJustifications: string[] = [];

      // Process each model for this iteration
      for (let j = 0; j < models.length; j++) {
        const modelInfo = models[j];
        const count = modelInfo.count || 1;
        const weight = modelInfo.weight;
        const allOutputs: number[][] = [];

        console.log(`Processing model: ${modelInfo.provider} - ${modelInfo.model}`);

        if (!modelInfo.provider || !modelInfo.model || weight < 0 || weight > 1) {
          return NextResponse.json(
            { error: 'Invalid model input. Check provider, model, and weight.' },
            { status: 400 }
          );
        }

        try {
          const llmProvider = await LLMFactory.getProvider(modelInfo.provider) as LLMProvider;
          if (!llmProvider) {
            return NextResponse.json(
              { error: `Unsupported provider: ${modelInfo.provider}` },
              { status: 400 }
            );
          }

          // Construct the full prompt based on iteration
          let iterationPrompt = `${prePromptConfig.prompt}\n\n${prompt}`;
          
          if (i > 0 && previousIterationResponses.length > 0) {
            const previousResponsesText = previousIterationResponses.join('\n\n');
            iterationPrompt = `${iterationPrompt}\n\n${postPromptConfig.prompt.replace('{{previousResponses}}', previousResponsesText)}`;
          }

          for (let c = 0; c < count; c++) {
            let responseText: string;
            if (attachments.length > 0 && llmProvider.supportsAttachments) {
              logInteraction(`Prompt to ${modelInfo.provider} - ${modelInfo.model} with attachments:\n${iterationPrompt}\n`);
              try {
                responseText = await llmProvider.generateResponseWithAttachments!(
                  iterationPrompt,
                  modelInfo.model,
                  attachments
                );
                logInteraction(`Response from ${modelInfo.provider} - ${modelInfo.model}:\n${responseText}\n`);
              } catch (providerError: any) {
                console.error(`Provider error from ${modelInfo.provider}/${modelInfo.model}:`, providerError);
                // Instead of returning right away, rethrow with provider info
                throw new Error(
                  `Error from ${modelInfo.provider}/${modelInfo.model}: ${providerError.message}`
                );
              }
            } else {
              logInteraction(`Prompt to ${modelInfo.provider} - ${modelInfo.model}:\n${iterationPrompt}\n`);
              try {
                responseText = await llmProvider.generateResponse(
                  iterationPrompt,
                  modelInfo.model
                );
                logInteraction(`Response from ${modelInfo.provider} - ${modelInfo.model}:\n${responseText}\n`);
              } catch (providerError: any) {
                console.error(`Provider error from ${modelInfo.provider}/${modelInfo.model}:`, providerError);
                throw new Error(
                  `Error from ${modelInfo.provider}/${modelInfo.model}: ${providerError.message}`
                );
              }
            }

            const { decisionVector, justification } = parseModelResponse(responseText);
            
            if (!decisionVector) {
              return NextResponse.json(
                { error: `Failed to parse decision vector from model ${modelInfo.model}. Response: ${responseText}` },
                { status: 400 }
              );
            }

            allOutputs.push(decisionVector);
            
            if (justification) {
              const formattedResponse = `From ${modelInfo.provider} - ${modelInfo.model}:\nScore: ${decisionVector}\nJustification: ${justification}`;
              iterationJustifications.push(`From model ${modelInfo.model}:\n${justification}`);
              
              if (i < iterations - 1) {
                previousIterationResponses.push(formattedResponse);
              }
            }
          }

          // Average the outputs for this model if count > 1
          const modelAverage = count > 1 
            ? averageVectors(allOutputs)
            : allOutputs[0];

          iterationOutputs.push(modelAverage);
          iterationWeights.push(weight);
        } catch (error: any) {
          // If we get here, a provider or parsing error occurred. 
          // Return immediately with the error text.  
          console.error('Caught provider error in route:', error);
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }
      }

      // Compute weighted average for this iteration
      finalAggregatedScore = computeAverageVectors(iterationOutputs, iterationWeights);

      // Generate justification for the final iteration
      if (i === iterations - 1) {
        const justifierProvider = await LLMFactory.getProvider(justifierProviderName);
        if (justifierProvider) {
          logInteraction(`Prompt to Justifier:\n${prompt}\n`);
          finalJustification = await generateJustification(
            finalAggregatedScore,
            iterationJustifications,
            justifierProvider,
            justifierModelName
          );
          logInteraction(`Response from Justifier:\n${finalJustification}\n`);
        }
      }
    }

    return NextResponse.json({
      aggregatedScore: finalAggregatedScore,
      justification: finalJustification
    });

  } catch (error: any) {
    console.error('Error in POST /api/rank-and-justify:', error);
    // If it's a provider error, we want to surface that as a 400
    // Otherwise, handle it as a 500.
    return NextResponse.json(
      { error: error.message || 'An error occurred while processing the request.' },
      { status: 400 }
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

// Helper function to compute average vectors
function computeAverageVectors(vectors: number[][], weights: number[]): number[] {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const dimensions = vectors[0].length;
  const result = new Array(dimensions).fill(0);

  for (let i = 0; i < vectors.length; i++) {
    for (let j = 0; j < dimensions; j++) {
      // Weighted accumulation
      result[j] += (vectors[i][j] * weights[Math.floor(i / (vectors.length / weights.length))]) / totalWeight;
    }
  }

  return result;
}

function averageVectors(vectors: number[][]): number[] {
  const dimensions = vectors[0].length;
  const result = new Array(dimensions).fill(0);
  
  for (let i = 0; i < vectors.length; i++) {
    for (let j = 0; j < dimensions; j++) {
      result[j] += vectors[i][j];
    }
  }
  
  for (let j = 0; j < dimensions; j++) {
    result[j] = Math.floor(result[j] / vectors.length);
  }
  
  return result;
}
