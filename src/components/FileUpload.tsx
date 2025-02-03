import React from 'react';

interface FileUploadProps {
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileUpload, disabled }: FileUploadProps) {
  return (
    <input
      type="file"
      onChange={onFileUpload}
      multiple
      className="p-2 border rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
      disabled={disabled}
    />
  );
} 