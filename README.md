# AI-Enabled Web App Template

This is a [Next.js](https://nextjs.org/) project that serves as a template for AI-enabled web applications. It demonstrates integration with various Language Model (LLM) providers, including open-source models, OpenAI, and Anthropic's Claude.

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
- `src/lib/llm/`: Contains the LLM provider implementations
  - `llm-provider-interface.ts`: Defines the interface for LLM providers
  - `llm-factory.ts`: Factory class for creating LLM provider instances
  - `openai-provider.ts`: OpenAI provider implementation
  - `claude-provider.ts`: Anthropic's Claude provider implementation
  - `ollama-provider.ts`: Ollama (open-source) provider implementation

## How It Works

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

4. The LLM providers are implemented as separate classes, each conforming to the `LLMProvider` interface. This allows for easy addition of new providers in the future.

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

1. Open `src/lib/llm/ollama-provider.ts` and update the `getModels` method:

   ```typescript
   async getModels(): Promise<string[]> {
     const response = await fetch(`${this.baseUrl}/api/tags`);
     const data = await response.json();
     // Filter or modify the list of models as needed
     return data.models
       .map((model: any) => model.name)
       .filter((name: string) => name.includes('llama') || name.includes('mistral'));
   }
   ```

2. For OpenAI, update `src/lib/llm/openai-provider.ts`:

   ```typescript
   async getModels(): Promise<string[]> {
     // Update this list with the models you want to make available
     return ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview'];
   }
   ```

3. For Claude, update `src/lib/llm/claude-provider.ts`:

   ```typescript
   async getModels(): Promise<string[]> {
     // Update this list with the Claude models you want to make available
     return ['claude-2.1', 'claude-3-opus-20240229'];
   }
   ```

4. If you want to add or remove entire providers, update the `PROVIDERS` array in `src/app/api/generate/route.ts`:

   ```typescript
   const PROVIDERS = ['Open-source', 'OpenAI', 'Anthropic', 'NewProvider'];
   ```

   Then, update the `LLMFactory` in `src/lib/llm/llm-factory.ts` to handle the new provider.

Remember to restart your development server after making these changes for them to take effect.

