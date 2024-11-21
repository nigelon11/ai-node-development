import React, { useState } from 'react';
import { ImageUpload } from './ImageUpload';
import { ModelSelector } from './ModelSelector';

interface ProviderModel {
  name: string;
  supportsImages: boolean;
  supportsAttachments: boolean;
}

interface ProviderModels {
  provider: string;
  models: ProviderModel[];
}

interface ModelWeight {
  provider: string;
  model: string;
  weight: number;
  count?: number;
}

interface RankAndJustifyFormProps {
  providerModels: ProviderModels[];
  isLoadingModels: boolean;
  onSubmit: (data: {
    prompt: string;
    models: ModelWeight[];
    image?: string;
    attachments?: string[];
    iterations?: number;
  }) => void;
}

export function RankAndJustifyForm({ providerModels, isLoadingModels, onSubmit }: RankAndJustifyFormProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedModels, setSelectedModels] = useState<ModelWeight[]>([]);
  const [iterations, setIterations] = useState(1);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleAddModel = () => {
    if (providerModels.length > 0) {
      const firstProvider = providerModels[0];
      const firstModel = firstProvider.models[0];
      setSelectedModels([
        ...selectedModels,
        {
          provider: firstProvider.provider,
          model: firstModel.name,
          weight: 1,
          count: 1
        }
      ]);
    }
  };

  const handleModelChange = (index: number, field: keyof ModelWeight, value: string | number) => {
    const updatedModels = [...selectedModels];
    updatedModels[index] = { ...updatedModels[index], [field]: value };
    setSelectedModels(updatedModels);
  };

  const handleRemoveModel = (index: number) => {
    setSelectedModels(selectedModels.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Convert files to base64
    const imageBase64 = uploadedImage ? await fileToBase64(uploadedImage) : undefined;
    const attachmentPromises = attachments.map(fileToBase64);
    const attachmentsBase64 = await Promise.all(attachmentPromises);

    onSubmit({
      prompt,
      models: selectedModels,
      image: imageBase64,
      attachments: attachmentsBase64,
      iterations
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium mb-2">
          Scenario Description:
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-2 border rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
          rows={4}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Models:</label>
        {selectedModels.map((model, index) => (
          <div key={index} className="flex gap-4 mb-4 items-center">
            <div>
              <label className="block text-xs mb-1">Provider</label>
              <select
                value={model.provider}
                onChange={(e) => handleModelChange(index, 'provider', e.target.value)}
                className="p-2 border rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              >
                {providerModels.map((pm) => (
                  <option key={pm.provider} value={pm.provider}>
                    {pm.provider}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1">Model</label>
              <select
                value={model.model}
                onChange={(e) => handleModelChange(index, 'model', e.target.value)}
                className="p-2 border rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              >
                {providerModels.find(pm => pm.provider === model.provider)?.models.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1">Weight</label>
              <input
                type="number"
                value={model.weight}
                onChange={(e) => handleModelChange(index, 'weight', parseFloat(e.target.value))}
                step="0.1"
                min="0"
                max="1"
                className="p-2 border rounded w-24 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              />
            </div>

            <div>
              <label className="block text-xs mb-1">Count</label>
              <input
                type="number"
                value={model.count || 1}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value >= 1 && Number.isInteger(value)) {
                    handleModelChange(index, 'count', value);
                  }
                }}
                min="1"
                step="1"
                className="p-2 border rounded w-24 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
                placeholder="Count"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => handleRemoveModel(index)}
                className="p-2 text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddModel}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Add Model
        </button>
      </div>

      <div>
        <label htmlFor="iterations" className="block text-sm font-medium mb-2">
          Iterations:
        </label>
        <input
          type="number"
          id="iterations"
          value={iterations}
          onChange={(e) => setIterations(parseInt(e.target.value))}
          min="1"
          className="p-2 border rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
        />
      </div>

      <div>
        <ImageUpload onImageUpload={setUploadedImage} />
      </div>

      {selectedModels.some(model => {
        const modelInfo = providerModels
          .find(pm => pm.provider === model.provider)
          ?.models.find(m => m.name === model.model);
        return modelInfo?.supportsAttachments;
      }) && (
        <div>
          <label htmlFor="attachments" className="block text-sm font-medium mb-2">
            Upload Files:
          </label>
          <input
            type="file"
            id="attachments"
            multiple
            onChange={handleFileChange}
            className="p-2 border rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
          />
        </div>
      )}

      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded"
        disabled={isLoadingModels || selectedModels.length === 0}
      >
        Analyze
      </button>
    </form>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
} 