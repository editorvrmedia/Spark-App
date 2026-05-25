import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchProfile, ProfileWithAchievements } from '../lib/api';
import { FollowButton } from '../components/FollowButton';
import { Database } from '../types/database';
import { Award, Edit3, Grid, ShieldAlert, Sparkles, X, Check, Camera, RefreshCw, Users } from 'lucide-react';

type DBPost = Database['public']['Tables']['posts']['Row'];

interface ProfileProps {
  username?: string | null; // Null means logged-in user
  onBack?: () => void;
}

const MOCK_USER_POSTS: Record<string, DBPost[]> = {
  spark_team: [
    {
      id: 'mock-1',
      author_id: 'auth-1',
      title: 'Welcome to Spark Social Feed',
      body: 'We are thrilled to launch the new Spark App feed. This interface is built with React, TypeScript, and Tailwind CSS.',
      media_urls: ['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop'],
      image_url: null,
      status: 'approved',
      rejection_reason: null,
      is_nsfw: false,
      is_pinned: true,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    }
  ],
  alex_dev: [
    {
      id: 'mock-2',
      author_id: 'auth-2',
      title: 'Frontend Optimization',
      body: 'Just finished profiling our bundle sizes. By utilizing postCSS, Autoprefixer, and Vite path aliases, we kept our bundle sizes incredibly small.',
      media_urls: ['https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=800&auto=format&fit=crop'],
      image_url: null,
      status: 'approved',
      rejection_reason: null,
      is_nsfw: false,
      is_pinned: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
    }
  ]
};

export const Profile: React.FC<ProfileProps> = ({ username, onBack }) => {
  const [profile, setProfile] = useState<ProfileWithAchievements | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string>('auth-2'); // default logged-in user in mock
  const [posts, setPosts] = useState<DBPost[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'posts' | 'achievements'>('posts');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState('');

  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setErrorMsg(null);

      try {
        let profileName = username;
        let loggedInId = 'auth-2';

        // 1. Resolve logged-in profile ID
        if (isSupabaseConfigured) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: loggedInRow } = await supabase
              .from('profiles')
              .select('id, username')
              .eq('user_id', user.id)
              .single();
            if (loggedInRow) {
              loggedInId = loggedInRow.id;
              setCurrentProfileId(loggedInId);
              if (!profileName) {
                profileName = loggedInRow.username;
              }
            }
          }
        } else {
          profileName = username || 'alex_dev';
          setCurrentProfileId(loggedInId);
        }

        if (!profileName) {
          setErrorMsg('No user profile context available.');
          setLoading(false);
          return;
        }

        // 2. Fetch target profile details
        const profileData = await fetchProfile(profileName);
        setProfile(profileData);
        
        setEditName(profileData.display_name || '');
        setEditBio(profileData.bio || '');
        setEditAvatar(profileData.avatar_url || '');

        // 3. Fetch follower & following metrics counts
        if (!isSupabaseConfigured) {
          // Simulation default metrics
          setFollowersCount(profileData.username === 'spark_team' ? 128 : 45);
          setFollowingCount(profileData.username === 'spark_team' ? 8 : 124);
          setPosts(MOCK_USER_POSTS[profileName] || []);
        } else {
          const { data: followerData } = await supabase.rpc('get_follower_count', { profile_id: profileData.id });
          const { data: followingData } = await supabase.rpc('get_following_count', { profile_id: profileData.id });
          
          setFollowersCount(Number(followerData || 0));
          setFollowingCount(Number(followingData || 0));

          // Fetch posts
          const { data: postsData, error: postsError } = await supabase
            .from('posts')
            .select('*')
            .eq('author_id', profileData.id)
            .eq('status', 'approved')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (!postsError && postsData) {
            setPosts(postsData);
          }
        }
      } catch (err: any) {
        console.error(err.message);
        setErrorMsg(err.message || 'An error occurred loading the profile.');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [username, isSupabaseConfigured]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);

    if (!isSupabaseConfigured) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setProfile(prev => prev ? {
        ...prev,
        display_name: editName,
        bio: editBio,
        avatar_url: editAvatar,
      } : null);
      setIsSaving(false);
      setIsEditOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: editName,
          bio: editBio,
          avatar_url: editAvatar,
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile(prev => prev ? {
        ...prev,
        display_name: editName,
        bio: editBio,
        avatar_url: editAvatar,
      } : null);

      setIsEditOpen(false);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getBadgeIcon = (type: string) => {
    switch (type) {
      case 'core_team':
        return <Sparkles className="w-5 h-5 text-amber-500" />;
      case 'student_leader':
        return <Award className="w-5 h-5 text-purple-500" />;
      default:
        return <Check className="w-5 h-5 text-indigo-500" />;
    }
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'core_team':
        return 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400';
      case 'student_leader':
        return 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/20 dark:border-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/30 dark:text-indigo-400';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-400 min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mb-2" />
        <span className="text-xs font-semibold">Loading profile...</span>
      </div>
    );
  }

  if (errorMsg || !profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 py-24 text-center min-h-screen">
        <ShieldAlert className="w-10 h-10 text-red-500 mb-2" />
        <span className="text-sm font-bold">Profile error</span>
        <p className="text-xs text-slate-500 mt-1">{errorMsg || 'Profile context not found.'}</p>
      </div>
    );
  }

  const isOwnProfile = profile.id === currentProfileId;

  return (
    <div className="flex-1 flex flex-col w-full max-w-md bg-white dark:bg-slate-950 min-h-screen pb-24">
      {/* Header bar - Premium Glassmorphic */}
      <header className="sticky top-0 z-45 glass-panel px-5 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack} 
              className="text-slate-600 dark:text-slate-400 font-semibold text-sm hover:underline"
            >
              ← Back
            </button>
          )}
          <span className="font-extrabold text-slate-900 dark:text-slate-100 text-lg">
            {profile.username}'s Profile
          </span>
        </div>
        
        {isOwnProfile ? (
          <button
            onClick={() => setIsEditOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Profile
          </button>
        ) : (
          <FollowButton 
            targetProfileId={profile.id} 
            currentProfileId={currentProfileId}
            onToggle={(following) => {
              setFollowersCount(prev => following ? prev + 1 : prev - 1);
            }}
          />
        )}
      </header>

      {/* Profile Details Header Section */}
      <div className="p-5 flex flex-col gap-4 border-b border-slate-100 dark:border-slate-900/80">
        <div className="flex items-center gap-5">
          {/* Avatar frame */}
          <div className="relative p-[1.5px] bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-600 rounded-full">
            {profile.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt="avatar" 
                className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-slate-950"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-850 flex items-center justify-center font-bold text-2xl border-4 border-white dark:border-slate-950 text-slate-500">
                {profile.display_name?.slice(0,2).toUpperCase() || 'SP'}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5 text-left">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 leading-tight">
                {profile.display_name || profile.username}
              </h2>
              <span className="text-xs text-slate-400 font-semibold tracking-wide">
                @{profile.username}
              </span>
            </div>
            
            {/* Social Follow Stats Row */}
            <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>{followersCount.toLocaleString()}</span>
                <span className="font-semibold text-slate-450 dark:text-slate-500">followers</span>
              </div>
              <div className="flex items-center gap-1">
                <span>{followingCount.toLocaleString()}</span>
                <span className="font-semibold text-slate-450 dark:text-slate-500">following</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pl-1 whitespace-pre-line text-left">
            {profile.bio}
          </p>
        )}
      </div>

      {/* Grid vs Achievements Tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-900/80 bg-slate-50/50 dark:bg-slate-900/30">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'posts'
              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          <Grid className="w-4 h-4" />
          Posts ({posts.length})
        </button>
        <button
          onClick={() => setActiveTab('achievements')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'achievements'
              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          <Award className="w-4 h-4" />
          Achievements ({profile.achievements.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="p-5 flex-1 flex flex-col">
        {activeTab === 'posts' && (
          <>
            {posts.length === 0 ? (
              <div className="py-16 text-center text-slate-450 text-xs font-medium">
                No published sparks found.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {posts.map(post => (
                  <div 
                    key={post.id} 
                    className="group relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-100 dark:border-slate-900 select-none cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                  >
                    {post.image_url || (post.media_urls && post.media_urls.length > 0) ? (
                      <img 
                        src={post.image_url || post.media_urls[0]} 
                        alt={post.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full p-4 flex flex-col justify-between items-start bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-slate-900 dark:to-slate-850">
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Spark Text</span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-3 text-left">
                          {post.title}
                        </p>
                        <div />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'achievements' && (
          <>
            {profile.achievements.length === 0 ? (
              <div className="py-16 text-center text-slate-450 text-xs font-medium">
                No achievements recorded yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {profile.achievements.map((badge) => (
                  <div 
                    key={badge.id} 
                    className={`flex items-center gap-3 p-3 rounded-2xl border ${getBadgeStyle(badge.badge_type)}`}
                  >
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800/40">
                      {getBadgeIcon(badge.badge_type)}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-extrabold">
                        {badge.title}
                      </span>
                      <span className="text-[11px] opacity-90 mt-0.5 leading-snug">
                        {badge.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-4 animate-[scaleUp_0.15s_cubic-bezier(0.16,_1,_0.3,_1)]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-extrabold text-slate-900 dark:text-slate-50 text-base">
                Edit Profile
              </span>
              <button 
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 text-left">
              {/* Display Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                  Display Name
                </label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3.5 py-2.5 rounded-2xl text-sm focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100"
                  placeholder="Enter display name"
                  maxLength={50}
                  required
                />
              </div>

              {/* Bio */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                  Bio
                </label>
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3.5 py-2.5 rounded-2xl text-sm focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100"
                  placeholder="Tell students about yourself"
                  maxLength={300}
                />
              </div>

              {/* Avatar Url */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                  Avatar Image Link
                </label>
                <div className="relative">
                  <input 
                    type="url" 
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 pl-10 pr-3.5 py-2.5 rounded-2xl text-sm focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100"
                    placeholder="https://images.unsplash.com/..."
                  />
                  <Camera className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Form buttons */}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-500 text-white font-bold py-3 px-4 rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-1.5 mt-2 shadow-lg shadow-purple-500/10 active:scale-[0.98]"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save Settings
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
