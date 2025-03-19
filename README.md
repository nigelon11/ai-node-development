# AI-Enabled Web App with Multi-Model Deliberation

This is a [Next.js](https://nextjs.org/) project that serves as a platform for AI-enabled web applications with advanced deliberation capabilities. It demonstrates integration with various Language Model (LLM) providers, including open-source models, OpenAI, and Anthropic's Claude.

## Application Overview

This application extends beyond traditional AI chatbots by introducing a unique multi-model deliberation system. Key features include:

- **Multi-LLM Integration**: Connect with multiple AI providers simultaneously (OpenAI, Anthropic Claude, and local Ollama models)
- **Collective Decision Making**: Employ multiple AI models to deliberate on questions or statements
- **Weighted Voting System**: Assign different weights to various models based on their reliability or expertise
- **Outcome Ranking**: Vote on and rank possible outcomes for a given prompt
- **Detailed Justifications**: Generate comprehensive explanations for collective decisions
- **Support for Attachments**: Process both text and image inputs for richer context
- **Interaction Logging**: Track and analyze all LLM interactions

The application's standout feature is its ability to aggregate insights from multiple AI models, creating a more balanced and nuanced response than any single model could provide alone.

## Getting Started

First, ensure you have Node.js installed on your system. Then, follow these steps:

1. Clone this repository to your local machine.
2. Install the dependencies:

npm install

3. Set up your environment variables:
   - Create a `.env.local` file in the root directory
   - Add your API keys for the LLM providers you want to use:
     ```
     OPENAI_API_KEY=your_openai_api_key
     ANTHROPIC_API_KEY=your_anthropic_api_key
     ```

4. Run the development server:

npm run dev

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `src/app/`: Contains the main application pages and API routes
  - `page.tsx`: The main page component with the UI for interacting with LLMs
  - `api/generate/`: API route for fetching available models and generating responses
  - `api/rank-and-justify/`: API route for multi-model deliberation and outcome ranking
- `src/lib/llm/`: Contains the LLM provider implementations
  - `llm-provider-interface.ts`: Defines the interface for LLM providers
  - `llm-factory.ts`: Factory class for creating LLM provider instances
  - `openai-provider.ts`: OpenAI provider implementation
  - `claude-provider.ts`: Anthropic's Claude provider implementation
  - `ollama-provider.ts`: Ollama (open-source) provider implementation
- `src/config/`: Configuration files
  - `models.ts`: Model configuration for different providers
  - `prePromptConfig.ts`: Configuration for prompts sent before user input
  - `postPromptConfig.ts`: Configuration for prompts sent after initial responses

## How It Works

### Basic LLM Interaction

1. The main page (`src/app/page.tsx`) allows users to:
   - Select an LLM provider
   - Choose a specific model from the selected provider
   - Enter a prompt
   - Generate a response based on the prompt and selected model

2. The application fetches available models from all providers when the page loads.

3. When a user submits a prompt:
   - The application sends a POST request to the `/api/generate` endpoint
   - The server-side code uses the appropriate LLM provider to generate a response
   - The generated response is sent back to the client and displayed on the page

### Multi-Model Deliberation

The application's advanced feature is the rank-and-justify system:

1. Multiple models from different providers can be assigned to deliberate on a prompt
2. Each model:
   - Receives the same input (with optional attachments)
   - Assigns scores to possible outcomes
   - Provides detailed justification for its decision
3. The system:
   - Weights each model's vote based on assigned importance
   - Aggregates scores across all participating models
   - Generates a final justification based on all individual justifications
   - Returns the ranked outcomes with the collective justification

This deliberation process creates a more balanced perspective by combining insights from multiple AI sources, reducing the bias or limitations of any single model.

## Customization

You can customize this template by:
- Adding new LLM providers in the `src/lib/llm/` directory
- Modifying the UI in `src/app/page.tsx`
- Extending the API functionality in `src/app/api/generate/route.ts`

## Learn More

To learn more about the technologies used in this project, check out the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [LangChain Documentation](https://js.langchain.com/docs/) - learn about LangChain, the library used for interacting with LLMs.

## Deployment

This project can be easily deployed on platforms like Vercel. Make sure to set up your environment variables in your deployment platform's settings.

For more details on deployment, refer to the [Next.js deployment documentation](https://nextjs.org/docs/deployment).

## Downloading Ollama Models Locally

To use Ollama models locally:

1. Install Ollama by following the instructions at [https://ollama.ai/](https://ollama.ai/).

2. Open a terminal and run the following command to download a model (e.g., llama2):

   ```
   ollama pull llama2
   ```

3. Repeat for any other models you want to use locally.

4. Ensure the Ollama service is running before starting your Next.js application.

## Updating Available Models

To change which models can be selected by the user:

1. Open `src/config/models.ts` and update the `modelConfig` object:

   ```typescript
   export const modelConfig = {
     openai: [
       { name: 'gpt-3.5-turbo', supportsImages: false },
       { name: 'gpt-4', supportsImages: false },
       { name: 'gpt-4o', supportsImages: true },
     ],
     anthropic: [
       { name: 'claude-2.1', supportsImages: false },
       { name: 'claude-3-sonnet-20240229', supportsImages: true },
     ],
   };
   ```

   Add, remove, or modify the models for OpenAI and Anthropic as needed. The `supportsImages` property determines whether the model can process image inputs.

2. For Open-source (local) models, use ollama as described above.   Models availble to the AI web template will be the ones listed with the command 

ollama list

New models can be added by pulling them using 

ollama pull model-name

A complete list of the models available can be found at the Ollama Library (https://ollama.com/library)

3. If you want to add or remove entire providers, update the `PROVIDERS` array in `src/app/api/generate/route.ts`:

   ```typescript
   const PROVIDERS = ['Open-source', 'OpenAI', 'Anthropic', 'NewProvider'];
   ```

   Then, update the `LLMFactory` in `src/lib/llm/llm-factory.ts` to handle the new provider.

Remember to restart your development server after making these changes for them to take effect.

## Additional Environment Variables

For the rank-and-justify feature, you may configure an additional environment variable:

```
JUSTIFIER_MODEL=provider:model-name
```

This defines which model will be used to generate the final justification for multi-model deliberations.

