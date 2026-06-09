import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, Loader2, Image, AlertCircle } from 'lucide-react';
import { createPost } from '../lib/api';

interface CreatePostProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

export const CreatePost: React.FC<CreatePostProps> = ({ isOpen, onClose, onPostCreated }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  const [profile, setProfile] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  // Automatically clear status messages
  useEffect(() => {
    if (!statusMsg) return;
    const timer = setTimeout(() => setStatusMsg(null), 5000);
    return () => clearTimeout(timer);
  }, [statusMsg]);

  // Load user profile details on mount
  useEffect(() => {
    if (!isOpen) return;

    async function loadUserProfile() {
      if (!isSupabaseConfigured) {
        setProfile({
          display_name: 'Alex Rivera',
          username: 'alex_dev',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
        });
        return;
      }

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!authError && user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
          setProfile(data);
        }
      } catch (err) {
        console.error('Error fetching user profile for CreatePost modal:', err);
      }
    }

    loadUserProfile();
  }, [isOpen, isSupabaseConfigured]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setStatusMsg({ type: 'error', text: 'Please select a valid image file.' });
        return;
      }
      // Limit file size to 5MB
      if (file.size > 5 * 1024 * 1024) {
        setStatusMsg({ type: 'error', text: 'Image size exceeds the 5MB limit.' });
        return;
      }

      setIsUploading(true);
      setStatusMsg(null);

      if (!isSupabaseConfigured) {
        // Simulation mode
        await new Promise(resolve => setTimeout(resolve, 1500));
        const randomNum = Math.floor(Math.random() * 100);
        const mockUrl = `https://images.unsplash.com/photo-${1618005182384 + randomNum}-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop`;
        setImageUrl(mockUrl);
        setIsUploading(false);
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

        if (uploadError) {
          console.error('[Upload Error]', uploadError);
          // Give specific user-friendly messages for common Supabase errors
          if (uploadError.message?.includes('Bucket not found') || uploadError.statusCode === '400') {
            throw new Error('Storage bucket not found. Please run the fix_storage_upload_policy.sql script in your Supabase SQL Editor.');
          } else if (uploadError.statusCode === '403' || uploadError.message?.includes('policy')) {
            throw new Error('Upload permission denied. Please run fix_storage_upload_policy.sql in Supabase SQL Editor to fix the storage policy.');
          } else if (uploadError.message?.includes('duplicate') || uploadError.message?.includes('already exists')) {
            throw new Error('A file with the same name already exists. Please try again.');
          }
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        setImageUrl(publicUrl);
      } catch (err: any) {
        console.error('[CreatePost] Image upload failed:', err);
        setStatusMsg({ type: 'error', text: err.message || 'Image upload failed. Check console for details.' });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || isUploading || isSubmitting) return;

    setIsSubmitting(true);
    setStatusMsg(null);

    // Fallback title if none provided
    const resolvedTitle = title.trim() || body.trim().slice(0, 45) + (body.length > 45 ? '...' : '');

    try {
      let authorId = 'auth-2'; // Default mock user (Alex Rivera)

      if (isSupabaseConfigured) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('Authentication required to publish posts.');

        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('id, is_suspended')
          .eq('user_id', user.id)
          .single();

        if (profileError || !userProfile) throw new Error('Could not retrieve user profile records.');
        if (userProfile.is_suspended) throw new Error('Your account is currently suspended. You cannot write posts.');
        authorId = userProfile.id;
      }

      await createPost(resolvedTitle, body, imageUrl, imageUrl ? [imageUrl] : [], authorId);

      setTitle('');
      setBody('');
      setImageUrl(null);
      onPostCreated?.();
      onClose();
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Failed to submit post.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-4 animate-[scaleUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)] text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50">
            Create a post
          </h2>
          <button 
            type="button" 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 ease-spring hover:scale-110 active:scale-90 w-9 h-9 flex items-center justify-center focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info Row */}
        {profile && (
          <div className="flex items-center gap-3 py-1">
            {profile.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt="avatar" 
                className="w-11 h-11 rounded-full object-cover border border-slate-100 dark:border-slate-800"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-slate-150 dark:bg-slate-850 flex items-center justify-center font-bold text-slate-500 text-sm">
                {profile.display_name?.slice(0, 2).toUpperCase() || 'SP'}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200 leading-tight">
                {profile.display_name || profile.username}
              </span>
              <div className="flex items-center gap-1 mt-1 px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-full w-max text-[10px] font-bold text-slate-500 dark:text-slate-400 select-none">
                🌎 Anyone
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {statusMsg && (
          <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-3.5 rounded-2xl flex items-start gap-2 text-xs border border-red-100 dark:border-red-900/30">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex flex-col gap-0.5">
              <p className="font-bold">Error</p>
              <p className="opacity-95 leading-relaxed">{statusMsg.text}</p>
            </div>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handlePublish} className="flex flex-col gap-3">
          {/* Optional Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add an optional bold title..."
            maxLength={300}
            disabled={isSubmitting}
            className="w-full bg-transparent border-none py-1 text-sm font-bold focus:outline-none placeholder-slate-400 text-slate-900 dark:text-slate-50"
          />

          {/* Body Text */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What do you want to talk about?"
            maxLength={40000}
            required
            rows={4}
            disabled={isSubmitting}
            className="w-full bg-transparent border-none py-1 text-sm focus:outline-none placeholder-slate-400 text-slate-800 dark:text-slate-200 resize-none min-h-[100px]"
          />

          {/* Attached Image Preview */}
          {imageUrl && (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-850 bg-slate-50 dark:bg-slate-950">
              <img
                src={imageUrl}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                disabled={isSubmitting}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center backdrop-blur-sm transition-all duration-200 active:scale-90 focus:outline-none"
                aria-label="Remove image"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isSubmitting || isUploading}
          />

          {/* Bottom Toolbar & Publish */}
          <div className="border-t border-slate-100 dark:border-slate-850 pt-4 flex items-center justify-between mt-2">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting || isUploading}
                className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none"
                aria-label="Add photo"
                title="Add photo"
              >
                {isUploading ? (
                  <Loader2 className="w-[22px] h-[22px] animate-spin text-purple-600" />
                ) : (
                  <Image className="w-[22px] h-[22px]" />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={!body.trim() || isUploading || isSubmitting}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-bold rounded-full text-xs transition-all duration-300 ease-spring hover:scale-105 active:scale-95 focus:outline-none shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Posting
                </>
              ) : (
                'Post'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
