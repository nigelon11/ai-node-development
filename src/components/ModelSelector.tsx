import React from 'react';

interface ModelSelectorProps {
  models: Array<{ name: string; supportsImages: boolean }>;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ models, selectedModel, onModelChange }) => {
  return (
    <select
      id="model"
      value={selectedModel}
      onChange={(e) => onModelChange(e.target.value)}
      className="w-full p-2 border rounded"
    >
      {models.map((model) => (
        <option key={model.name} value={model.name}>
          {model.name} {model.supportsImages ? '(Supports Images)' : ''}
        </option>
      ))}
    </select>
  );
};