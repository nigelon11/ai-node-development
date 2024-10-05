'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ImageUpload } from '../components/ImageUpload';
import { ModelSelector } from '../components/ModelSelector';

interface ProviderModels {
  provider: string;
  models: Array<{ name: string; supportsImages: boolean }>;
}

export default function Home() {
  const [prompt, setPrompt] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [providerModels, setProviderModels] = useState<ProviderModels[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);

  useEffect(() => {
    setIsLoadingModels(true);
    fetch('/api/generate')
      .then(response => response.json())
      .then(data => {
        console.log('API response:', data);
        if (data && data.models && Array.isArray(data.models)) {
          const groupedModels = data.models.reduce((acc, { provider, model }) => {
            if (!acc[provider]) {
              acc[provider] = [];
            }
            acc[provider].push(model);
            return acc;
          }, {});

          const providerData = Object.entries(groupedModels).map(([provider, models]) => ({
            provider,
            models,
          }));

          console.log('Provider data:', providerData);
          setProviderModels(providerData);
          if (providerData.length > 0) {
            setSelectedProvider(providerData[0].provider);
            setSelectedModel(providerData[0].models[0]?.name || '');
          }
        } else {
          console.error('Unexpected data structure:', data);
          setProviderModels([]);
        }
      })
      .catch(error => {
        console.error('Error fetching models:', error);
        setProviderModels([]);
      })
      .finally(() => setIsLoadingModels(false));
  }, []);

  const resetForm = () => {
    setResult('');
    setUploadedImage(null);
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setSelectedProvider(newProvider);
    const providerModelList = providerModels.find(pm => pm.provider === newProvider)?.models || [];
    if (providerModelList.length > 0) {
      setSelectedModel(providerModelList[0].name);
    } else {
      setSelectedModel('');
    }
    resetForm();
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult('');

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('provider', selectedProvider);
      formData.append('model', selectedModel);
      if (uploadedImage) {
        formData.append('image', uploadedImage);
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.result) {
        throw new Error('No result returned from the API');
      }

      setResult(data.result);
    } catch (error) {
      console.error('Error:', error);
      setResult(error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred while generating the response.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI-Enabled Web App Template</h1>
      
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="mb-4">
          <label htmlFor="prompt" className="block mb-2">Enter your prompt:</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full p-2 border rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
            rows={4}
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="provider" className="block mb-2">Select Provider:</label>
          <select
            id="provider"
            value={selectedProvider}
            onChange={handleProviderChange}
            className="w-full p-2 border rounded mb-2 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
          >
            {providerModels.map((pm) => (
              <option key={pm.provider} value={pm.provider} className="text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800">
                {pm.provider}
              </option>
            ))}
          </select>

          <label htmlFor="model" className="block mb-2">Select LLM model:</label>
          {isLoadingModels ? (
            <p>Loading models...</p>
          ) : providerModels.length > 0 ? (
            <ModelSelector
              models={providerModels.find(pm => pm.provider === selectedProvider)?.models || []}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              className=""
            />
          ) : (
            <p>No models available</p>
          )}
        </div>

        {providerModels.find(pm => pm.provider === selectedProvider)?.models.find(m => m.name === selectedModel)?.supportsImages && (
          <>
            <ImageUpload onImageUpload={setUploadedImage} />
            {uploadedImage && <p className="mt-2 text-sm text-green-600">Image uploaded successfully</p>}
          </>
        )}

        <button 
          type="submit" 
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={isLoading || isLoadingModels}
        >
          {isLoading ? 'Generating...' : 'Generate'}
        </button>
      </form>
      
      {result && (
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Result:</h2>
          <pre className="p-4 bg-white dark:bg-gray-800 rounded whitespace-pre-wrap text-gray-900 dark:text-gray-100">{result}</pre>
        </div>
      )}

      {/* ... (chart component remains the same) */}
    </main>
  )
}