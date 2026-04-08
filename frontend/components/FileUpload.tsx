'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label?: string;
  description?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({
  accept = '.vcf,.vcf.gz',
  multiple = false,
  onFiles,
  label = 'Upload file',
  description = 'Drag and drop or click to select a VCF file',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      const arr = Array.from(incoming);
      setSelectedFiles((prev) => (multiple ? [...prev, ...arr] : arr));
      onFiles(multiple ? arr : arr.slice(0, 1));
    },
    [multiple, onFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      onFiles(next);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors text-center',
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'
        )}
      >
        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
          <Upload size={22} className="text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-200">{label}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
          <p className="text-xs text-gray-600 mt-1">Accepts: {accept}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
          aria-label={label}
        />
      </div>

      {/* Selected file list */}
      {selectedFiles.length > 0 && (
        <ul className="space-y-2">
          {selectedFiles.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
            >
              <FileText size={16} className="text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors"
                aria-label={`Remove ${file.name}`}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
