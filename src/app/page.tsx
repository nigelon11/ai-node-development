'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ImageUpload } from '../components/ImageUpload';
import { ModelSelector } from '../components/ModelSelector';
import { TabSelector } from '../components/TabSelector';
import { RankAndJustifyForm } from '../components/RankAndJustifyForm';

interface ProviderModels {
  provider: string;
  models: Array<{ name: string; supportsImages: boolean; supportsAttachments: boolean }>;
}

interface RankAndJustifyResult {
  aggregatedScore: number[];
  justification: string;
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
  const [attachments, setAttachments] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<string>('generate');
  const [rankResult, setRankResult] = useState<RankAndJustifyResult | null>(null);

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
    setAttachments([]);
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
    const selectedProviderModels = providerModels.find(pm => pm.provider === selectedProvider);
    const modelInfo = selectedProviderModels?.models.find(m => m.name === model);

    if (modelInfo && !modelInfo.supportsAttachments && attachments.length > 0) {
      alert('This model does not support attachments. Please remove attachments or select a different model.');
      return;
    }

    setSelectedModel(model);
    resetForm();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
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

      if (attachments.length > 0) {
        attachments.forEach((file, index) => {
          formData.append(`file${index}`, file);
        });
      }

      if (uploadedImage && !providerModels.find(pm => pm.provider === selectedProvider)
          ?.models.find(m => m.name === selectedModel)?.supportsAttachments) {
        formData.append('image', uploadedImage);
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setResult(data.result);
    } catch (error) {
      console.error('Error:', error);
      setResult(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRankAndJustifySubmit = async (data: {
    prompt: string;
    models: Array<{
      provider: string;
      model: string;
      weight: number;
      count?: number;
    }>;
    image?: string;
    attachments?: string[];
    iterations?: number;
  }) => {
    setIsLoading(true);
    setRankResult(null);

    try {
      const response = await fetch('/api/rank-and-justify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setRankResult(result);
    } catch (error) {
      console.error('Error:', error);
      setResult(error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredModels = providerModels.find(pm => pm.provider === selectedProvider)?.models.filter(m => {
    return attachments.length === 0 || m.supportsAttachments;
  }) || [];

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">AI Model Interface</h1>
      
      <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'generate' ? (
        <form onSubmit={handleSubmit} className="space-y-6" aria-label="Generate AI Response">
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
                models={filteredModels}
                selectedModel={selectedModel}
                onModelChange={handleModelChange}
                className=""
              />
            ) : (
              <p>No models available</p>
            )}
          </div>

          {providerModels.find(pm => pm.provider === selectedProvider)
            ?.models.find(m => m.name === selectedModel)
            ?.supportsAttachments && (
            <div className="mb-4">
              <label htmlFor="attachments" className="block mb-2">Upload Files:</label>
              <input
                type="file"
                id="attachments"
                multiple
                onChange={handleFileChange}
                className="w-full p-2 border rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              />
            </div>
          )}

          {providerModels.find(pm => pm.provider === selectedProvider)
            ?.models.find(m => m.name === selectedModel)
            ?.supportsImages && !providerModels.find(pm => pm.provider === selectedProvider)
            ?.models.find(m => m.name === selectedModel)
            ?.supportsAttachments && (
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

          {result && (
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-2">Result:</h2>
              <pre className="p-4 bg-white dark:bg-gray-800 rounded whitespace-pre-wrap text-gray-900 dark:text-gray-100">{result}</pre>
            </div>
          )}
        </form>
      ) : (
        <div>
          <h2 className="text-2xl font-bold mb-4">Rank & Justify</h2>
          <RankAndJustifyForm
            providerModels={providerModels}
            isLoadingModels={isLoadingModels}
            onSubmit={handleRankAndJustifySubmit}
          />
          
          {rankResult && (
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4">Analysis Results:</h3>
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Scores:</h4>
                <pre className="p-4 bg-white dark:bg-gray-800 rounded">
                  {JSON.stringify(rankResult.aggregatedScore, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Justification:</h4>
                <pre className="p-4 bg-white dark:bg-gray-800 rounded whitespace-pre-wrap">
                  {rankResult.justification}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ... (chart component remains the same) */}
    </main>
  )
}