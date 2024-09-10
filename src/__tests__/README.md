# Testing Architecture and Guidelines

This folder contains the test files for our AI-Enabled Web App Template. We use Jest as our testing framework along with React Testing Library for component testing.

## Setting Up a New Test File

1. Create a new file with the naming convention `[component-name].test.tsx` or `[module-name].test.ts` in the appropriate subfolder.
2. Import the necessary testing utilities and the component/module to be tested.
3. Use `describe` blocks to group related tests.
4. Write individual test cases using the `test` or `it` function.

## Test File Descriptions

### 1. Home.test.tsx

Location: `__tests__/components/Home.test.tsx`

This file tests the main Home component of our application. It covers:

- Rendering of main components
- User input handling
- Form submission and API interaction
- Error handling

Key features:
- Mocks the global `fetch` function to control API responses
- Uses `waitFor` for asynchronous operations

### 2. openai-provider.test.ts

Location: `__tests__/lib/llm/openai-provider.test.ts`

This file tests the OpenAIProvider class. It covers:

- Retrieving available models
- Generating responses

Key features:
- Mocks the `ChatOpenAI` class from `@langchain/openai`
- Tests the provider's interface methods

### 3. generate.test.ts

Location: `__tests__/api/generate.test.ts`

This file tests the API route handler for the `/api/generate` endpoint. It covers:

- GET request for fetching available models
- Error handling for the GET request

Key features:
- Mocks the `NextResponse` and `LLMFactory` to isolate the route handler logic
- Tests both successful and error scenarios

## Writing Effective Tests

1. Use descriptive test names that explain the expected behavior.
2. Mock external dependencies and API calls to isolate the component/module being tested.
3. Test both successful and error scenarios.
4. Use `beforeEach` to set up common test conditions and `afterEach` for cleanup if necessary.
5. For component tests, use React Testing Library's queries that resemble how users interact with your app (e.g., `getByText`, `getByRole`).

## Running Tests

To run all tests:

```
npm test
```

To run tests in watch mode:

```
npm run test:watch
```

To run a specific test file:

```
npm test -- path/to/your/test/file.test.ts
```

Remember to keep your tests up to date as you modify your components and functionality. Well-maintained tests serve as documentation and help prevent regressions.
