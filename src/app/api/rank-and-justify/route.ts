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

interface RankAndJustifyInput {
  prompt: string;
  outcomes?: string[];  // Optional array of outcome descriptions
  models: ModelInput[];
  iterations?: number;
  attachments?: string[];
}

interface ScoreOutcome {
  outcome: string;
  score: number;
}

interface RankAndJustifyOutput {
  scores: ScoreOutcome[];
  justification: string;
}

interface LLMProvider {
  generateResponse: (prompt: string, model: string) => Promise<string>;
  generateResponseWithAttachments?: (prompt: string, model: string, attachments: any[]) => Promise<string>;
  supportsAttachments: (model: string) => boolean;
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
    const body: RankAndJustifyInput = await request.json();
    console.log('Request body:', {
      prompt: body.prompt,
      models: body.models,
      hasAttachments: body.attachments?.length ?? 0 > 0,
      attachmentsCount: body.attachments?.length ?? 0
    });

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
    if (body.attachments?.length) {
      console.log('Processing attachments...');
      body.attachments.forEach((content, index) => {
        console.log(`Attachment ${index + 1}:`);
        console.log('- Content type:', typeof content);
        if (typeof content === 'string') {
          console.log('- Starts with:', content.substring(0, 50) + '...');
          if (content.startsWith('data:')) {
            const mediaTypeMatch = content.match(/^data:([^;]+);base64,/);
            console.log('- Media type:', mediaTypeMatch ? mediaTypeMatch[1] : 'unknown');
          } else {
            console.log('- WARNING: Attachment does not start with data: URI scheme');
          }
        } else {
          console.log('- WARNING: Attachment is not a string');
        }
      });
    }

    const attachments = body.attachments?.map((content, index) => {
      if (content.startsWith('data:image')) {
        const mediaTypeMatch = content.match(/^data:([^;]+);base64,/);
        const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : 'image/jpeg';
        console.log(`Processing image attachment ${index + 1}:`, {
          mediaType,
          contentLength: content.length,
          isBase64: content.includes(';base64,')
        });
        
        const base64Data = content.replace(/^data:image\/[^;]+;base64,/, '');
        return {
          type: 'image',
          content: base64Data,
          mediaType: mediaType
        };
      }
      console.log(`Processing non-image attachment ${index + 1}:`, {
        type: 'text',
        contentLength: content.length
      });
      return {
        type: 'text',
        content: content,
        mediaType: 'text/plain'
      };
    }) || [];

    // Log processed attachments summary
    console.log('Processed attachments summary:', attachments.map(att => ({
      type: att.type,
      mediaType: att.mediaType,
      contentLength: att.content.length
    })));

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
          // Cast to unknown first to avoid type mismatch
          const llmProvider = await LLMFactory.getProvider(modelInfo.provider) as unknown as LLMProvider;
          if (!llmProvider) {
            return NextResponse.json(
              { error: `Unsupported provider: ${modelInfo.provider}` },
              { status: 400 }
            );
          }

          // Construct the full prompt based on iteration
          let iterationPrompt = `${prePromptConfig.getPrompt(body.outcomes)}\n\n${prompt}`;
          
          if (i > 0 && previousIterationResponses.length > 0) {
            const previousResponsesText = previousIterationResponses.join('\n\n');
            iterationPrompt = `${iterationPrompt}\n\n${postPromptConfig.prompt.replace('{{previousResponses}}', previousResponsesText)}`;
          }

          if (attachments.length > 0) {
            console.log(`Sending ${attachments.length} attachments to ${modelInfo.provider}:`, 
              attachments.map(att => ({
                type: att.type,
                mediaType: att.mediaType,
                contentLength: att.content.length
              }))
            );
          }

          for (let c = 0; c < count; c++) {
            let responseText: string;
            if (attachments.length > 0 && llmProvider.supportsAttachments(modelInfo.model)) {
              logInteraction(`Prompt to ${modelInfo.provider} - ${modelInfo.model} with attachments:\n${iterationPrompt}\n`);
              try {
                responseText = await llmProvider.generateResponseWithAttachments!(
                  iterationPrompt,
                  modelInfo.model,
                  attachments
                );
                logInteraction(`Response from ${modelInfo.provider} - ${modelInfo.model}:\n${responseText}\n`);
              } catch (providerError: any) {
                console.error(`Provider error from ${modelInfo.provider}/${modelInfo.model}:`, {
                  error: providerError.message,
                  stack: providerError.stack,
                  attachments: attachments.length > 0 ? 'Has attachments' : 'No attachments'
                });
                return NextResponse.json({
                  error: providerError.message,
                  scores: [] as ScoreOutcome[],
                  justification: ''
                }, { status: 400 });
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
                console.error(`Provider error from ${modelInfo.provider}/${modelInfo.model}:`, {
                  error: providerError.message,
                  stack: providerError.stack,
                  attachments: attachments.length > 0 ? 'Has attachments' : 'No attachments'
                });
                return NextResponse.json({
                  error: providerError.message,
                  scores: [] as ScoreOutcome[],
                  justification: ''
                }, { status: 400 });
              }
            }

            const { decisionVector, justification, scores } = parseModelResponse(responseText, body.outcomes);
            
            if (!decisionVector) {
              return NextResponse.json({
                error: `Failed to parse decision vector from model ${modelInfo.model}. Response: ${responseText}`,
                scores: [] as ScoreOutcome[],
                justification: ''
              }, { status: 400 });
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
      scores: body.outcomes 
        ? finalAggregatedScore.map((score, index) => ({
            outcome: body.outcomes![index],
            score: Math.floor(score)
          }))
        : finalAggregatedScore.map(score => ({
            outcome: 'unnamed',
            score: Math.floor(score)
          })),
      justification: finalJustification
    } as RankAndJustifyOutput);

  } catch (error: any) {
    console.error('Error in POST /api/rank-and-justify:', {
      error: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    return NextResponse.json({
      error: error.message || 'An error occurred while processing the request.',
      scores: [] as ScoreOutcome[],
      justification: ''
    }, { status: 500 });
  }
}

// Helper function to parse the model response
function parseModelResponse(responseText: string, outcomes?: string[]): {
  decisionVector: number[] | null;
  justification: string;
  scores: ScoreOutcome[];
} {
  try {
    console.log('parseModelResponse input:', {
      responseText: responseText.substring(0, 200) + '...',  // Log first 200 chars
      hasOutcomes: !!outcomes,
      outcomesLength: outcomes?.length
    });

    // Try multiple strategies to extract JSON from the response
    let response;

    // Strategy 0: Try direct JSON parsing first
    try {
      const trimmedResponse = responseText.trim();
      if (trimmedResponse.startsWith('{') && trimmedResponse.endsWith('}')) {
        const parsed = JSON.parse(trimmedResponse);
        if (parsed && typeof parsed === 'object' && 'score' in parsed && 'justification' in parsed) {
          response = parsed;
          console.log('Successfully parsed direct JSON');
        }
      }
    } catch (e) {
      console.log('Direct JSON parsing failed');
    }

    // Strategy 1: Try to find JSON in code blocks
    if (!response) {
      const jsonBlockMatch = responseText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (jsonBlockMatch) {
        try {
          response = JSON.parse(jsonBlockMatch[1].trim());
          console.log('Successfully parsed JSON from markdown block');
        } catch (e) {
          console.log('Failed to parse JSON from markdown block');
        }
      }
    }

    // Strategy 2: Try to find any JSON-like structure in the text
    if (!response) {
      // Updated regex to better handle multiline JSON
      const jsonMatch = responseText.match(/\{[\s\S]*?\}/g);
      if (jsonMatch) {
        for (const potentialJson of jsonMatch) {
          try {
            const parsed = JSON.parse(potentialJson);
            if (parsed && typeof parsed === 'object' && 'score' in parsed && 'justification' in parsed) {
              response = parsed;
              console.log('Successfully parsed JSON from text');
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
    }

    // Strategy 3: Try the old format with SCORE: and JUSTIFICATION:
    if (!response) {
      console.log('Trying old format parsing');
      const scoreMatch = responseText.match(/SCORE:\s*([0-9,\s]+)/i);
      const justificationMatch = responseText.match(/JUSTIFICATION:\s*([^]*?)(?:$|SCORE:)/i);
      
      console.log('Old format parsing results:', {
        hasScoreMatch: !!scoreMatch,
        scoreMatchGroups: scoreMatch?.length,
        hasJustificationMatch: !!justificationMatch,
        justificationMatchGroups: justificationMatch?.length
      });
      
      if (scoreMatch) {
        const scores = scoreMatch[1].split(',').map(s => parseInt(s.trim()));
        const justification = justificationMatch ? justificationMatch[1].trim() : '';
        
        response = {
          score: scores,
          justification: justification
        };
        console.log('Successfully parsed old format');
      }
    }

    // Validate the response structure
    if (!response || typeof response !== 'object') {
      throw new Error('Could not extract valid JSON response from model output');
    }

    if (!Array.isArray(response.score)) {
      throw new Error('Score must be an array of numbers');
    }

    if (typeof response.justification !== 'string') {
      throw new Error('Justification must be a string');
    }

    // Validate that all scores are integers
    const decisionVector = response.score.map(Number);
    console.log('Parsed decision vector:', decisionVector);

    if (decisionVector.some(isNaN)) {
      throw new Error('All scores must be valid numbers');
    }

    // If outcomes are provided, validate the length matches
    if (outcomes && decisionVector.length !== outcomes.length) {
      throw new Error(`Score array length (${decisionVector.length}) does not match outcomes length (${outcomes.length})`);
    }

    // Validate that scores sum to 1,000,000
    const sum = decisionVector.reduce((a: number, b: number) => a + b, 0);
    if (sum !== 1000000) {
      throw new Error(`Scores must sum to 1,000,000 (got ${sum})`);
    }

    // Create the scores array with outcomes if provided, or "unnamed" if not
    const scores = decisionVector.map((score: number, index: number) => ({
      outcome: outcomes?.[index] || `outcome${index + 1}`,  // Use "outcome1", "outcome2" etc if no outcomes provided
      score
    }));

    console.log('Final parsed result:', {
      decisionVector,
      justification: response.justification.substring(0, 100) + '...',
      scores
    });

    return {
      decisionVector,
      justification: response.justification,
      scores  // Always return scores in the correct format
    };
  } catch (err) {
    console.error('Error parsing model response:', err);
    console.error('Raw response:', responseText);
    return { 
      decisionVector: null, 
      justification: '', 
      scores: []  // Return empty array instead of undefined
    };
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
