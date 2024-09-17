import React from 'react';

interface ImageUploadProps {
  onImageUpload: (file: File | null) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onImageUpload(file);
  };

  return (
    <div className="mb-4">
      <label htmlFor="image-upload" className="block mb-2">Upload Image:</label>
      <input
        type="file"
        id="image-upload"
        accept="image/*"
        onChange={handleFileChange}
        className="w-full p-2 border rounded"
      />
    </div>
  );
};