import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Sparkles, User, FileText, CheckCircle2 } from 'lucide-react';

interface ProfileOnboardingProps {
  session: any;
  currentProfileId: string | null;
  onComplete: (newProfileId?: string) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop', // Student 1
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop', // Student 2
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop', // Student 3
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop', // Student 4
];

export const ProfileOnboarding: React.FC<ProfileOnboardingProps> = ({
  session,
  currentProfileId,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(session?.user?.user_metadata?.display_name || '');
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploading(true);
      setErrorMsg(null);

      if (!isSupabaseConfigured) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setSelectedAvatar('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop');
        setUploading(false);
        return;
      }

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_avatar.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Upload to post-images storage bucket (public access is configured)
        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);

        setSelectedAvatar(publicUrl);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to upload avatar.');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleCompleteSetup = async () => {
    if (!displayName.trim()) {
      setErrorMsg('Please enter a display name.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);

    if (!isSupabaseConfigured) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSaving(false);
      onComplete();
      return;
    }

    try {
      // 1. Check if profile exists first to handle trigger fallback
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      let resolvedProfileId = existingProfile?.id;

      if (existingProfile) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            display_name: displayName.trim(),
            bio: bio.trim(),
            avatar_url: selectedAvatar,
          })
          .eq('user_id', session.user.id);

        if (updateError) throw updateError;
      } else {
        // Insert missing profile
        const fallbackUsername = session.user.user_metadata?.username || 
          'user_' + session.user.id.replace(/-/g, '').slice(0, 8);
        
        const { data: insertedData, error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: session.user.id,
            username: fallbackUsername,
            display_name: displayName.trim(),
            bio: bio.trim(),
            avatar_url: selectedAvatar,
            role: 'user',
            is_suspended: false,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        resolvedProfileId = insertedData?.id;
      }

      // 2. Award Welcoming Achievement "Early Sparkler" inside Database
      const finalProfileId = currentProfileId || resolvedProfileId;

      if (finalProfileId) {
        try {
          await supabase.from('achievements').insert({
            profile_id: finalProfileId,
            badge_type: 'contributor',
            title: 'Early Sparkler',
            description: 'Successfully completed initial student profile wizard.',
          });
        } catch (achievementErr) {
          console.error('Failed to insert onboarding achievement:', achievementErr);
        }
      }

      setSaving(false);
      onComplete(finalProfileId || undefined);
    } catch (err: any) {
      setErrorMsg(err.message || 'Setup saving failed. Please check connection.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 w-full max-w-md mx-auto">
      {/* Background ambient glowing blobs */}
      <div className="absolute w-[250px] h-[250px] bg-purple-500/10 dark:bg-purple-600/15 top-[15%] left-[-10%] blur-3xl rounded-full pointer-events-none" />
      <div className="absolute w-[250px] h-[250px] bg-pink-500/10 dark:bg-pink-600/15 bottom-[15%] right-[-10%] blur-3xl rounded-full pointer-events-none" />

      {/* Main glass card */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 p-8 flex flex-col gap-6 text-center z-10 animate-[scaleUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)] relative">
        
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
            Step {step} of 2
          </span>
          <div className="flex gap-1.5">
            <div className={`w-6 h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'bg-purple-600 w-10' : 'bg-purple-100 dark:bg-purple-950'}`} />
            <div className={`w-6 h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'bg-purple-600 w-10' : 'bg-purple-100 dark:bg-purple-950'}`} />
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 text-xs font-bold p-3.5 rounded-2xl border border-red-200/20 text-left flex items-start gap-2 animate-shake">
            <span>⚠️ {errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Avatar Customization */}
        {step === 1 && (
          <div className="flex flex-col gap-5 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                Select Your Avatar
              </h2>
              <p className="text-xs text-slate-450 dark:text-slate-400 font-medium">
                Choose a preset character or upload your own profile photo.
              </p>
            </div>

            {/* Avatar Preview */}
            <div className="relative mx-auto mt-2">
              <div className="p-1 bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-600 rounded-full w-24 h-24 flex items-center justify-center shadow-lg">
                {uploading ? (
                  <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  </div>
                ) : (
                  <img
                    src={selectedAvatar}
                    alt="Selected Profile"
                    className="w-full h-full rounded-full object-cover border-4 border-white dark:border-slate-900"
                  />
                )}
              </div>
              <span className="absolute bottom-0 right-0 p-1.5 bg-purple-600 text-white rounded-full border-2 border-white dark:border-slate-900 shadow-md">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Preset grid */}
            <div className="flex justify-center gap-3 mt-1">
              {PRESET_AVATARS.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedAvatar(url)}
                  className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-300 hover:scale-110 ${
                    selectedAvatar === url ? 'border-purple-600 scale-105 shadow-md shadow-purple-500/20' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt="Preset avatar" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {/* Custom upload */}
            <div className="relative mt-2">
              <input
                type="file"
                id="avatar-file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploading}
              />
              <label
                htmlFor="avatar-file"
                className="w-full flex items-center justify-center gap-2 px-5 py-3 border border-dashed border-slate-200 dark:border-slate-800 hover:border-purple-500 hover:bg-purple-50/10 rounded-2xl text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer transition-all duration-300"
              >
                <User className="w-4 h-4 text-slate-400" />
                Upload custom picture
              </label>
            </div>

            <button
              onClick={() => setStep(2)}
              className="mt-4 w-full py-3.5 bg-purple-650 hover:bg-purple-750 text-white rounded-2xl text-xs font-black tracking-wider uppercase shadow-lg shadow-purple-500/15 transition-all duration-300 ease-spring active:scale-95 focus:outline-none"
            >
              Continue to Details
            </button>
          </div>
        )}

        {/* STEP 2: Name and Bio */}
        {step === 2 && (
          <div className="flex flex-col gap-5 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                Profile Information
              </h2>
              <p className="text-xs text-slate-455 dark:text-slate-400 font-medium">
                Let fellow students know who you are and what you study.
              </p>
            </div>

            {/* Avatar quick thumbnail */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-150/40 dark:border-slate-850/40 text-left">
              <img src={selectedAvatar} alt="thumbnail" className="w-9 h-9 rounded-full object-cover border border-white dark:border-slate-900" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wide leading-none">Avatar selected</span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 mt-1">Ready for profile publication</span>
              </div>
            </div>

            {/* Display name field */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest pl-1">
                Display Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-4 py-3 pl-10 rounded-2xl text-xs focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100 shadow-sm font-semibold"
                />
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Bio textarea */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest pl-1">
                About Bio
              </label>
              <div className="relative">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe your role, interests, or study flow (max 300 characters)..."
                  maxLength={300}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-4 py-3 pl-10 rounded-2xl text-xs focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100 shadow-sm font-semibold leading-relaxed resize-none"
                />
                <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-3.5 border border-slate-205 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-xs font-black tracking-wider uppercase transition-all duration-300 ease-spring active:scale-95 focus:outline-none"
              >
                Back
              </button>
              <button
                onClick={handleCompleteSetup}
                disabled={saving}
                className="flex-grow py-3.5 bg-purple-650 hover:bg-purple-750 text-white rounded-2xl text-xs font-black tracking-wider uppercase shadow-lg shadow-purple-500/15 transition-all duration-300 ease-spring active:scale-95 focus:outline-none flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Save Profile
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
