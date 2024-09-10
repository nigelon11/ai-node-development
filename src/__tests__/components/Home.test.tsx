/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../../app/page';

// Mock the global fetch function to control API responses in tests
global.fetch = jest.fn((url, options) => {
  if (url === '/api/generate') {
    if (options && options.method === 'POST') {
      // Mock successful POST response
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: 'Generated response' }),
      });
    } else {
      // Mock successful GET response
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ models: [{ provider: 'OpenAI', model: 'gpt-3.5-turbo' }] }),
      });
    }
  }
  // Mock error response for unknown URLs
  return Promise.reject(new Error('Not found'));
}) as jest.Mock;

// Describe block groups related tests together
describe('Home component', () => {
  // beforeEach runs before each test in this describe block
  beforeEach(() => {
    // Clear all mock function calls before each test
    jest.clearAllMocks();
  });

  // Individual test case
  test('renders main components', async () => {
    // Render the component to be tested
    render(<Home />);
    
    // Use expect statements to check if elements are in the document
    expect(screen.getByText('AI-Enabled Web App Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Enter your prompt:')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Provider:')).toBeInTheDocument();
    // Use waitFor for asynchronous operations
    await waitFor(() => expect(screen.getByLabelText('Select LLM model:')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  });

  // Test user interactions
  test('handles user input', async () => {
    render(<Home />);
    
    // Simulate user input and check if the input value changes
    const promptInput = screen.getByLabelText('Enter your prompt:');
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    expect(promptInput).toHaveValue('Test prompt');

    // Wait for asynchronous operations and test select inputs
    await waitFor(() => {
      const providerSelect = screen.getByLabelText('Select Provider:');
      fireEvent.change(providerSelect, { target: { value: 'OpenAI' } });
      expect(providerSelect).toHaveValue('OpenAI');
    });

    await waitFor(() => {
      const modelSelect = screen.getByLabelText('Select LLM model:');
      fireEvent.change(modelSelect, { target: { value: 'gpt-3.5-turbo' } });
      expect(modelSelect).toHaveValue('gpt-3.5-turbo');
    });
  });

  // Test form submission and API interaction
  test('submits form and displays result', async () => {
    render(<Home />);

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByLabelText('Select Provider:')).toHaveValue('OpenAI');
      expect(screen.getByLabelText('Select LLM model:')).toHaveValue('gpt-3.5-turbo');
    });

    // Simulate filling out the form
    fireEvent.change(screen.getByLabelText('Enter your prompt:'), { target: { value: 'Test prompt' } });

    // Simulate form submission
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    // Wait for and check the result
    await waitFor(() => {
      expect(screen.getByText('Result:')).toBeInTheDocument();
      expect(screen.getByText(/Generated response/)).toBeInTheDocument();
    });

    // Verify that the fetch function was called with correct arguments
    expect(fetch).toHaveBeenCalledWith('/api/generate', expect.any(Object));
  });

  // Test error handling
  test('handles API error', async () => {
    render(<Home />);

    // Wait for initial data to load
    await waitFor(() => {
      expect(screen.getByLabelText('Select Provider:')).toHaveValue('OpenAI');
      expect(screen.getByLabelText('Select LLM model:')).toHaveValue('gpt-3.5-turbo');
    });

    // Simulate filling out the form
    fireEvent.change(screen.getByLabelText('Enter your prompt:'), { target: { value: 'Test prompt' } });

    // Mock the fetch function to simulate an error response
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'An error occurred while generating the response.' }),
      })
    ) as jest.Mock;

    // Simulate form submission
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    // Wait for and check the error message
    await waitFor(() => {
      expect(screen.getByText(/Error: An error occurred while generating the response/)).toBeInTheDocument();
    });
  });
});



