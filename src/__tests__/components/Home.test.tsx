/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../../app/page';

// Mock the ImageUpload component
jest.mock('../../components/ImageUpload', () => ({
  ImageUpload: ({ onImageUpload }) => (
    <input
      type="file"
      data-testid="image-upload"
      onChange={(e) => onImageUpload(e.target.files[0])}
    />
  ),
}));

// Mock the global fetch function
global.fetch = jest.fn((url) => {
  if (url === '/api/generate') {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        models: [
          { provider: 'OpenAI', model: { name: 'gpt-3.5-turbo', supportsImages: false } },
          { provider: 'OpenAI', model: { name: 'gpt-4', supportsImages: false } },
          { provider: 'OpenAI', model: { name: 'gpt-4o', supportsImages: true } },
          { provider: 'Anthropic', model: { name: 'claude-2', supportsImages: false } },
          { provider: 'Anthropic', model: { name: 'claude-3-sonnet-20240229', supportsImages: true } },
        ],
      }),
    });
  }
  return Promise.reject(new Error('Not found'));
}) as jest.Mock;

describe('Home component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders main components', async () => {
    render(<Home />);
  
    expect(screen.getByText('AI-Enabled Web App Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Enter your prompt:')).toBeInTheDocument();
    expect(screen.getByLabelText('Select Provider:')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByLabelText('Select LLM model:')).toBeInTheDocument();
    }, { timeout: 5000 });
    
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  }, 10000);

  test('handles user input', async () => {
    render(<Home />);
    
    const promptInput = screen.getByLabelText('Enter your prompt:');
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    expect(promptInput).toHaveValue('Test prompt');

    await waitFor(() => {
      const providerSelect = screen.getByLabelText('Select Provider:');
      fireEvent.change(providerSelect, { target: { value: 'OpenAI' } });
      expect(providerSelect).toHaveValue('OpenAI');
    });

    await waitFor(() => {
      const modelSelect = screen.getByLabelText('Select LLM model:');
      fireEvent.change(modelSelect, { target: { value: 'gpt-4o' } });
      expect(modelSelect).toHaveValue('gpt-4o');
    });
  });

  test('submits form and displays result', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          models: [
            { provider: 'OpenAI', model: { name: 'gpt-3.5-turbo', supportsImages: false } },
            { provider: 'OpenAI', model: { name: 'gpt-4', supportsImages: false } },
            { provider: 'OpenAI', model: { name: 'gpt-4o', supportsImages: true } },
          ],
        }),
      }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: 'Generated response' }),
      }));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByLabelText('Select Provider:')).toHaveValue('OpenAI');
      expect(screen.getByLabelText('Select LLM model:')).toHaveValue('gpt-3.5-turbo');
    });

    fireEvent.change(screen.getByLabelText('Enter your prompt:'), { target: { value: 'Test prompt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => {
      expect(screen.getByText('Result:')).toBeInTheDocument();
      expect(screen.getByText(/Generated response/)).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith('/api/generate', expect.any(Object));
  });

  test('handles API error', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          models: [
            { provider: 'OpenAI', model: { name: 'gpt-3.5-turbo', supportsImages: false } },
          ],
        }),
      }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'An error occurred while generating the response.' }),
      }));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByLabelText('Select Provider:')).toHaveValue('OpenAI');
      expect(screen.getByLabelText('Select LLM model:')).toHaveValue('gpt-3.5-turbo');
    });

    fireEvent.change(screen.getByLabelText('Enter your prompt:'), { target: { value: 'Test prompt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => {
      expect(screen.getByText(/Error: An error occurred while generating the response/)).toBeInTheDocument();
    });
  });

  test('shows image upload for models that support images', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        models: [
          { provider: 'OpenAI', model: { name: 'gpt-3.5-turbo', supportsImages: false } },
          { provider: 'OpenAI', model: { name: 'gpt-4', supportsImages: false } },
          { provider: 'OpenAI', model: { name: 'gpt-4o', supportsImages: true } },
        ],
      }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByLabelText('Select Provider:')).toBeInTheDocument();
      expect(screen.getByLabelText('Select LLM model:')).toBeInTheDocument();
    });

    const providerSelect = screen.getByLabelText('Select Provider:');
    fireEvent.change(providerSelect, { target: { value: 'OpenAI' } });

    const modelSelect = screen.getByLabelText('Select LLM model:');
    fireEvent.change(modelSelect, { target: { value: 'gpt-4o' } });

    await waitFor(() => {
      expect(screen.getByTestId('image-upload')).toBeInTheDocument();
    });

    fireEvent.change(modelSelect, { target: { value: 'gpt-3.5-turbo' } });

    await waitFor(() => {
      expect(screen.queryByTestId('image-upload')).not.toBeInTheDocument();
    });
  });
});



