import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UploadCloud, X, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  onUploadStart: () => void;
  onUploadComplete: (url: string) => void;
  onUploadError: (err: string) => void;
  onClear: () => void;
  previewUrl: string | null;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onUploadStart,
  onUploadComplete,
  onUploadError,
  onClear,
  previewUrl,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  const handleUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      onUploadError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }
    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      onUploadError('Image size exceeds the 5MB limit.');
      return;
    }

    setIsUploading(true);
    onUploadStart();

    if (!isSupabaseConfigured) {
      // Simulation mode
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Return a premium mock unsplash image based on keywords
        const randomNum = Math.floor(Math.random() * 100);
        const mockUrl = `https://images.unsplash.com/photo-${1618005182384 + randomNum}-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop`;
        onUploadComplete(mockUrl);
      } catch (err) {
        onUploadError('Simulated upload failed.');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      onUploadComplete(publicUrl);
    } catch (err: any) {
      onUploadError(err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full flex flex-col gap-2.5">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {previewUrl ? (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <img
            src={previewUrl}
            alt="Upload preview"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            disabled={isUploading}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center backdrop-blur-sm transition-all duration-200 active:scale-90 focus:outline-none"
            aria-label="Remove image"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`w-full aspect-video md:aspect-[2.2/1] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 p-6 text-center cursor-pointer transition-all duration-200 ${
            dragActive
              ? 'border-purple-500 bg-purple-50/20 dark:bg-purple-950/10'
              : 'border-slate-200 hover:border-purple-400 dark:border-slate-800 dark:hover:border-purple-500/60 bg-slate-50/50 hover:bg-purple-50/5 dark:bg-slate-900/30'
          } ${isUploading ? 'pointer-events-none' : ''}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-9 h-9 animate-spin text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 animate-pulse">Uploading Image...</span>
            </div>
          ) : (
            <>
              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm">
                <UploadCloud className="w-6 h-6 text-purple-500" strokeWidth={1.75} />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Drag & drop post image, or <span className="text-purple-600 dark:text-purple-400 underline">browse</span>
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                  PNG, JPG, WEBP up to 5MB
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
