'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ProviderModels {
  provider: string;
  models: string[];
}

export default function Home() {
  const [prompt, setPrompt] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [providerModels, setProviderModels] = useState<ProviderModels[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);

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
            setSelectedModel(providerData[0].models[0] || '');
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

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    setSelectedProvider(newProvider);
    const models = providerModels.find(pm => pm.provider === newProvider)?.models || [];
    setSelectedModel(models[0] || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, provider: selectedProvider, model: selectedModel }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate response');
      }

      const data = await response.json();
      setResult(typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2));
    } catch (error) {
      console.error('Error:', error);
      setResult('An error occurred while generating the response.');
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
            className="w-full p-2 border rounded"
            rows={4}
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="provider" className="block mb-2">Select Provider:</label>
          <select
            id="provider"
            value={selectedProvider}
            onChange={handleProviderChange}
            className="w-full p-2 border rounded mb-2"
          >
            {providerModels.map((pm) => (
              <option key={pm.provider} value={pm.provider}>{pm.provider}</option>
            ))}
          </select>

          <label htmlFor="model" className="block mb-2">Select LLM model:</label>
          {isLoadingModels ? (
            <p>Loading models...</p>
          ) : providerModels.length > 0 ? (
            <select
              id="model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-2 border rounded"
            >
              {providerModels.find(pm => pm.provider === selectedProvider)?.models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          ) : (
            <p>No models available</p>
          )}
        </div>

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
          <pre className="p-4 bg-gray-100 rounded whitespace-pre-wrap">{result}</pre>
        </div>
      )}

      {/* ... (chart component remains the same) */}
    </main>
  )
}