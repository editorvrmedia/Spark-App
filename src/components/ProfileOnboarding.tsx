import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, Sparkles, User, FileText, CheckCircle2 } from 'lucide-react';

interface ProfileOnboardingProps {
  session: any;
  currentProfileId: string | null;
  onComplete: (newProfileId?: string) => void;
}

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Vivian',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Liam',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mason',
];

const INTEREST_CATEGORIES = {
  sports: [
    { label: 'Cricket 🏏', value: 'Cricket 🏏' },
    { label: 'Football ⚽', value: 'Football ⚽' },
    { label: 'Basketball 🏀', value: 'Basketball 🏀' },
    { label: 'Badminton 🏸', value: 'Badminton 🏸' },
    { label: 'Athletics 🏃', value: 'Athletics 🏃' },
  ],
  cultural: [
    { label: 'Music 🎵', value: 'Music 🎵' },
    { label: 'Dance 💃', value: 'Dance 💃' },
    { label: 'Drama 🎭', value: 'Drama 🎭' },
    { label: 'Art/Painting 🎨', value: 'Art/Painting 🎨' },
    { label: 'Photography 📸', value: 'Photography 📸' },
  ],
  other: [
    { label: 'Coding 💻', value: 'Coding 💻' },
    { label: 'Debating 🗣️', value: 'Debating 🗣️' },
    { label: 'Chess ♟️', value: 'Chess ♟️' },
    { label: 'Gaming 🎮', value: 'Gaming 🎮' },
    { label: 'Volunteering 🤝', value: 'Volunteering 🤝' },
  ]
};

export const ProfileOnboarding: React.FC<ProfileOnboardingProps> = ({
  session,
  currentProfileId,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const getDefaultDisplayName = () => {
    if (session?.user?.user_metadata?.display_name) {
      return session.user.user_metadata.display_name;
    }
    const emailVal = session?.user?.email || '';
    if (emailVal) {
      const localPart = emailVal.split('@')[0] || '';
      const namePart = localPart.split(/[._\-\d]/)[0] || localPart;
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    return '';
  };
  const [displayName, setDisplayName] = useState(getDefaultDisplayName());
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  useEffect(() => {
    async function loadExistingProfile() {
      if (!isSupabaseConfigured || !session?.user?.id || session.user.id === 'mock-user-id') {
        return;
      }
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, bio, interests, avatar_url')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (profile) {
          if (profile.display_name) {
            setDisplayName(profile.display_name);
          }
          if (profile.bio) {
            setBio(profile.bio);
          }
          if (profile.avatar_url) {
            setSelectedAvatar(profile.avatar_url);
          }
          if (profile.interests && profile.interests.length > 0) {
            setSelectedInterests(profile.interests);
          }
        }
      } catch (err) {
        console.error('Failed to load existing profile for onboarding:', err);
      }
    }
    loadExistingProfile();
  }, [session, isSupabaseConfigured]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploading(true);
      setErrorMsg(null);

      if (!isSupabaseConfigured || !session?.user?.id || session.user.id === 'mock-user-id') {
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

  const handleTagClick = (tagValue: string) => {
    setSelectedInterests((prev) =>
      prev.includes(tagValue)
        ? prev.filter((item) => item !== tagValue)
        : [...prev, tagValue]
    );
  };

  const handleCompleteSetup = async () => {
    if (!displayName.trim()) {
      setErrorMsg('Please enter a display name.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);

    if (!isSupabaseConfigured || !session?.user?.id || session.user.id === 'mock-user-id') {
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
            interests: selectedInterests,
            avatar_url: selectedAvatar,
          })
          .eq('user_id', session.user.id);

        if (updateError) throw updateError;
      } else {
        // Insert missing profile
        let fallbackUsername = session.user.user_metadata?.username;
        if (!fallbackUsername) {
          const emailVal = session?.user?.email || '';
          if (emailVal) {
            const localPart = emailVal.split('@')[0] || '';
            fallbackUsername = (localPart.split(/[._\-\d]/)[0] || localPart).toLowerCase();
          }
        }
        if (!fallbackUsername) {
          fallbackUsername = 'user_' + session.user.id.replace(/-/g, '').slice(0, 8);
        }
        
        const { data: insertedData, error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: session.user.id,
            username: fallbackUsername,
            display_name: displayName.trim(),
            bio: bio.trim(),
            interests: selectedInterests,
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
      let msg = err.message || 'Setup saving failed. Please check connection.';
      if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('rls policy')) {
        msg += ' (Supabase Tip: This error typically occurs if your email is unconfirmed, or if the database triggers in full_setup.sql were not executed in your Supabase project.)';
      }
      setErrorMsg(msg);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 w-full relative overflow-hidden">
      {/* Background ambient glowing blobs */}
      <div className="absolute w-[350px] h-[350px] bg-purple-500/10 dark:bg-purple-600/15 top-[15%] left-[-10%] blur-3xl rounded-full pointer-events-none" />
      <div className="absolute w-[350px] h-[350px] bg-pink-500/10 dark:bg-pink-600/15 bottom-[15%] right-[-10%] blur-3xl rounded-full pointer-events-none" />

      {/* Main glass card */}
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800/40 p-8 flex flex-col gap-6 z-10 animate-[scaleUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)] relative">
        
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800/50">
          <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
            Step {step} of 2: {step === 1 ? 'Select Avatar' : 'Profile Details'}
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

        {/* Content container - split screen on desktop */}
        <div className="flex flex-col md:flex-row gap-8 items-stretch">
          
          {/* Left Column: Live Profile Preview Card (Desktop Only) */}
          <div className="hidden md:flex md:w-[35%] bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-850/60 p-5 flex-col justify-between text-center relative overflow-hidden min-h-[340px]">
            {/* Header banner glow */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-650 dark:from-purple-900/30 dark:via-pink-900/30 dark:to-indigo-900/30" />
            
            <div className="relative z-10 flex flex-col items-center mt-4">
              {/* Avatar ring */}
              <div className="p-[3px] bg-white dark:bg-slate-900 rounded-full w-20 h-20 shadow-md">
                {uploading ? (
                  <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : (
                  <img
                    src={selectedAvatar}
                    alt="Preview avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                )}
              </div>

              {/* Name */}
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-55 mt-3 line-clamp-1">
                {displayName.trim() || 'Your Name'}
              </h3>
              
              {/* Username preview */}
              <span className="text-[9px] text-slate-400 font-bold tracking-wide mt-0.5">
                @{session?.user?.user_metadata?.username || 'username'}
              </span>

              {/* Bio */}
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 line-clamp-2 leading-relaxed px-1 select-none italic">
                {bio.trim() ? `"${bio.trim()}"` : '"St. Brittos student profile..."'}
              </p>

              {/* Selected Interests Preview */}
              {selectedInterests.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center mt-2.5 max-h-[50px] overflow-hidden w-full px-1">
                  {selectedInterests.slice(0, 3).map((interest) => (
                    <span
                      key={interest}
                      className="px-1.5 py-0.5 rounded-full text-[7.5px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100/50 dark:border-purple-900/30"
                    >
                      {interest}
                    </span>
                  ))}
                  {selectedInterests.length > 3 && (
                    <span className="text-[7.5px] font-bold text-slate-450 self-center">
                      +{selectedInterests.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="relative z-10 mt-4 pt-3 border-t border-slate-150 dark:border-slate-900/50 flex flex-col gap-0.5 items-center">
              <span className="text-[9px] font-black text-purple-500 uppercase tracking-widest">
                Academic Card Preview
              </span>
              <span className="text-[8.5px] text-slate-400 font-medium">
                Updates live as you type
              </span>
            </div>
          </div>

          {/* Right Column: Setup Steps */}
          <div className="flex-1 flex flex-col justify-center">
            {/* STEP 1: Avatar Customization */}
            {step === 1 && (
              <div className="flex flex-col gap-5 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex flex-col gap-1 text-left">
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                    Select Your Avatar
                  </h2>
                  <p className="text-xs text-slate-450 dark:text-slate-400 font-medium">
                    Choose a preset character or upload your own profile photo.
                  </p>
                </div>

                {/* Avatar Preview (Mobile/Fallback view) */}
                <div className="relative mx-auto mt-2 md:hidden">
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
                <div className="flex justify-center md:justify-start gap-3 mt-1">
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
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 border border-dashed border-slate-205 dark:border-slate-800 hover:border-purple-500 hover:bg-purple-50/10 rounded-2xl text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer transition-all duration-300"
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
                <div className="flex flex-col gap-1 text-left">
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                    Profile Information
                  </h2>
                  <p className="text-xs text-slate-455 dark:text-slate-400 font-medium">
                    Let fellow students know who you are and what you study.
                  </p>
                </div>

                {/* Avatar quick thumbnail (Mobile view) */}
                <div className="flex md:hidden items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-150/40 dark:border-slate-850/40 text-left">
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
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-widest pl-1">
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

                {/* Quick interest tags helper */}
                <div className="flex flex-col gap-2.5 mt-0.5 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-150 dark:border-slate-800/60 text-left">
                  <span className="text-[9px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-widest pl-1">
                    Select Interests & Hobbies (Click to toggle)
                  </span>
                  
                  {/* Sports */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 pl-1">SPORTS & ATHLETICS</span>
                    <div className="flex flex-wrap gap-1.5">
                      {INTEREST_CATEGORIES.sports.map((tag) => {
                        const isSelected = selectedInterests.includes(tag.value);
                        return (
                          <button
                            key={tag.value}
                            type="button"
                            onClick={() => handleTagClick(tag.value)}
                            className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                              isSelected
                                ? 'bg-purple-650 text-white shadow-sm shadow-purple-500/20 scale-95'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-purple-300 dark:hover:border-purple-855 hover:scale-105 active:scale-95'
                            }`}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cultural */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 pl-1">ARTS & CULTURAL</span>
                    <div className="flex flex-wrap gap-1.5">
                      {INTEREST_CATEGORIES.cultural.map((tag) => {
                        const isSelected = selectedInterests.includes(tag.value);
                        return (
                          <button
                            key={tag.value}
                            type="button"
                            onClick={() => handleTagClick(tag.value)}
                            className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                              isSelected
                                ? 'bg-purple-650 text-white shadow-sm shadow-purple-500/20 scale-95'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-purple-300 dark:hover:border-purple-855 hover:scale-105 active:scale-95'
                            }`}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Other */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <span className="text-[8px] font-bold text-slate-400 dark:text-slate-550 pl-1 font-black">OTHER INTERESTS</span>
                    <div className="flex flex-wrap gap-1.5">
                      {INTEREST_CATEGORIES.other.map((tag) => {
                        const isSelected = selectedInterests.includes(tag.value);
                        return (
                          <button
                            key={tag.value}
                            type="button"
                            onClick={() => handleTagClick(tag.value)}
                            className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                              isSelected
                                ? 'bg-purple-650 text-white shadow-sm shadow-purple-500/20 scale-95'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-purple-300 dark:hover:border-purple-855 hover:scale-105 active:scale-95'
                            }`}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setStep(1)}
                    className="w-1/3 py-3.5 border border-slate-205 dark:border-slate-800 text-slate-650 dark:text-slate-400 rounded-2xl text-xs font-black tracking-wider uppercase transition-all duration-300 ease-spring active:scale-95 focus:outline-none"
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
      </div>
    </div>
  );
};
