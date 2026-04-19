"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, ImageIcon } from "lucide-react";

interface ImageUploaderProps {
  onImageSelect: (base64: string, mimeType: string, file: File) => void;
  selectedFile?: File | null;
  onClear?: () => void;
}

export default function ImageUploader({
  onImageSelect,
  selectedFile,
  onClear,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreview(result);
        const base64 = result.split(",")[1];
        onImageSelect(base64, file.type, file);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleClear = useCallback(() => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  }, [onClear]);

  return (
    <div className="w-full">
      {preview && selectedFile ? (
        <div className="relative rounded-xl overflow-hidden border border-[#2a2a3a] bg-[#12121a]">
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-96 object-contain"
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <div className="bg-[#0a0a0f]/80 backdrop-blur-sm text-xs text-gray-300 px-3 py-1.5 rounded-full border border-[#2a2a3a]">
              {selectedFile.name}
            </div>
            <button
              onClick={handleClear}
              className="bg-[#0a0a0f]/80 backdrop-blur-sm text-gray-300 hover:text-white p-1.5 rounded-full border border-[#2a2a3a] hover:border-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative flex flex-col items-center justify-center gap-4
            w-full min-h-52 rounded-xl cursor-pointer
            border-2 border-dashed transition-all duration-200
            ${
              isDragging
                ? "border-[#7c6dfa] bg-[#7c6dfa]/10"
                : "border-[#2a2a3a] bg-[#12121a] hover:border-[#7c6dfa]/50 hover:bg-[#7c6dfa]/5"
            }
          `}
        >
          <div
            className={`
            p-4 rounded-full transition-colors
            ${isDragging ? "bg-[#7c6dfa]/20" : "bg-[#1e1e2e]"}
          `}
          >
            {isDragging ? (
              <ImageIcon size={32} className="text-[#7c6dfa]" />
            ) : (
              <Upload size={32} className="text-gray-500" />
            )}
          </div>
          <div className="text-center">
            <p className="text-gray-300 font-medium">
              {isDragging ? "Drop image here" : "Drop image or click to upload"}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              PNG, JPG, WEBP, GIF supported
            </p>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
