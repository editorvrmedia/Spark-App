import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchProfile, ProfileWithAchievements, isUuid } from '../lib/api';
import { FollowButton } from '../components/FollowButton';
import { PostCard } from '../components/PostCard';
import { Database } from '../types/database';
import { Award, Edit3, Grid, ShieldAlert, Sparkles, X, Check, Camera, RefreshCw, ShieldCheck, CheckCircle, Calendar } from 'lucide-react';

type DBPost = Database['public']['Tables']['posts']['Row'];

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
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [editAvatar, setEditAvatar] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingAvatar(true);
      setUploadError(null);

      if (!isSupabaseConfigured) {
        // Simulation mode
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setEditAvatar('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop');
        setUploadingAvatar(false);
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

        setEditAvatar(publicUrl);
      } catch (err: any) {
        setUploadError(err.message || 'Failed to upload avatar.');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

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
          if (user && user.id !== 'mock-user-id') {
            // Real Supabase user
            const { data: loggedInRow } = await supabase
              .from('profiles')
              .select('id, username')
              .eq('user_id', user.id)
              .maybeSingle();
            if (loggedInRow) {
              loggedInId = loggedInRow.id;
              setCurrentProfileId(loggedInId);
              if (!profileName) {
                profileName = loggedInRow.username;
              }
            }
          } else {
            // Sandbox bypass mode — use mock user
            profileName = username || 'alex_dev';
            setCurrentProfileId(loggedInId);
          }
        } else {
          profileName = username || 'alex_dev';
          setCurrentProfileId(loggedInId);
        }

        if (!profileName) {
          // Final fallback to sandbox user
          profileName = 'alex_dev';
        }

        // 2. Fetch target profile details
        const profileData = await fetchProfile(profileName);
        setProfile(profileData);

        setEditName(profileData.display_name || '');
        setEditBio(profileData.bio || '');
        setEditInterests(profileData.interests || []);
        setEditAvatar(profileData.avatar_url || '');

        // 3. Fetch follower & following metrics counts
        if (!isSupabaseConfigured || !isUuid(profileData.id)) {
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
            .select(`
              *,
              likes(count),
              comments(count)
            `)
            .eq('author_id', profileData.id)
            .eq('status', 'approved')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (!postsError && postsData) {
            const formatted = postsData.map((post: any) => ({
              ...post,
              likes_count: post.likes?.[0]?.count ?? 0,
              comments_count: post.comments?.[0]?.count ?? 0
            }));
            setPosts(formatted);
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

    if (!isSupabaseConfigured || !isUuid(profile.id)) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setProfile(prev => prev ? {
        ...prev,
        display_name: editName,
        bio: editBio,
        interests: editInterests,
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
          interests: editInterests,
          avatar_url: editAvatar,
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile(prev => prev ? {
        ...prev,
        display_name: editName,
        bio: editBio,
        interests: editInterests,
        avatar_url: editAvatar,
      } : null);

      setIsEditOpen(false);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTagClick = (tagValue: string) => {
    setEditInterests((prev) =>
      prev.includes(tagValue)
        ? prev.filter((item) => item !== tagValue)
        : [...prev, tagValue]
    );
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
    <div className="flex-1 flex flex-col w-full max-w-5xl bg-slate-50 dark:bg-slate-950 min-h-screen pb-24 md:pb-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header bar - Premium Glassmorphic */}
      <header className="sticky top-0 z-40 glass-panel px-5 py-4 flex items-center justify-between shadow-sm border-b border-slate-100 dark:border-slate-900/50">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl transition-colors text-slate-650 dark:text-slate-400"
              aria-label="Go back"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="font-extrabold text-slate-950 dark:text-slate-50 text-base">
            {profile.username}'s Profile
          </span>
        </div>

        {isOwnProfile ? (
          <button
            onClick={() => setIsEditOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 rounded-full text-xs font-bold text-purple-600 dark:text-purple-400 transition-all active:scale-[0.98]"
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

      {/* Top Profile Card Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm mx-5 mt-4 text-left">
        {/* Banner Cover */}
        <div className="relative w-full h-32 md:h-44 bg-gradient-to-r from-purple-650 via-pink-650 to-indigo-650 dark:from-purple-900/30 dark:via-pink-900/30 dark:to-indigo-900/30 overflow-hidden">
          <div className="absolute -top-10 -left-10 w-28 h-28 bg-white/10 rounded-full blur-lg animate-pulse" />
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-xl" />
        </div>

        {/* Info Column */}
        <div className="px-6 pb-6 relative">
          {/* Avatar overlap */}
          <div className="flex justify-between items-end mt-[-40px] md:mt-[-52px] relative z-10 w-full mb-3">
            <div className={`p-[3px] rounded-full shadow-md bg-white dark:bg-slate-900 ${profile.role === 'admin'
                ? 'bg-gradient-to-tr from-amber-400 via-yellow-500 to-orange-500'
                : profile.role === 'moderator'
                  ? 'bg-gradient-to-tr from-fuchsia-500 via-purple-500 to-indigo-500'
                  : 'bg-gradient-to-tr from-blue-400 via-teal-500 to-indigo-500'
              }`}>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="avatar"
                  className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-white dark:border-slate-900"
                />
              ) : (
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-200 dark:bg-slate-850 flex items-center justify-center font-bold text-2xl border-4 border-white dark:border-slate-900 text-slate-550">
                  {profile.display_name?.slice(0, 2).toUpperCase() || 'SP'}
                </div>
              )}
            </div>

            {/* Desktop Action button */}
            <div className="pb-1">
              {isOwnProfile ? (
                <button
                  onClick={() => setIsEditOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-purple-650 hover:bg-purple-50 dark:hover:bg-purple-950/20 rounded-full text-xs font-bold text-purple-650 dark:text-purple-400 transition-all active:scale-[0.98]"
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
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50 tracking-tight">
                {profile.display_name || profile.username}
              </h2>
              {/* Role Badges */}
              {profile.role === 'admin' && (
                <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" />
                  Admin
                </span>
              )}
              {profile.role === 'moderator' && (
                <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  <ShieldAlert className="w-3 h-3" />
                  Moderator
                </span>
              )}
              {profile.role === 'user' && (
                <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  <CheckCircle className="w-3 h-3" />
                  Verified Student
                </span>
              )}
            </div>

            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              @{profile.username}
            </span>

            {/* School / Campus Info */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">
              <span className="text-purple-505">🎓</span>
              <span>St. Brittos Academy Campus Student</span>
            </div>

            {/* Connection Counters */}
            <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400 mt-3 pl-0.5">
              <span>{posts.length} sparks</span>
              <span>•</span>
              <span className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer">{followersCount.toLocaleString()} followers</span>
              <span>•</span>
              <span className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer">{followingCount.toLocaleString()} following</span>
            </div>
          </div>
        </div>
      </div>

      {/* About Section Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800/80 rounded-xl p-6 shadow-sm mx-5 mt-4 text-left flex flex-col gap-2.5">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          About
        </h3>
        {profile.bio ? (
          <p className="text-xs text-slate-700 dark:text-slate-350 leading-relaxed whitespace-pre-line">
            {profile.bio}
          </p>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-600 italic">
            No bio summary details provided yet. Add a display name, avatar, and bio to stand out.
          </p>
        )}
      </div>

      {/* Interests Section Card */}
      {profile.interests && profile.interests.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800/80 rounded-xl p-6 shadow-sm mx-5 mt-4 text-left flex flex-col gap-2.5 animate-[fadeIn_0.25s_ease-out]">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Interests & Hobbies
          </h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {profile.interests.map((interest) => (
              <span
                key={interest}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/30 text-purple-650 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 transition-all hover:scale-105"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grid vs Achievements Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/30 mx-5 mt-5">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all duration-300 ease-spring active:scale-95 focus:outline-none ${activeTab === 'posts'
              ? 'border-purple-650 text-purple-655 dark:border-purple-400 dark:text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
        >
          <Grid className="w-4 h-4" />
          Sparks ({posts.length})
        </button>
        <button
          onClick={() => setActiveTab('achievements')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all duration-300 ease-spring active:scale-95 focus:outline-none ${activeTab === 'achievements'
              ? 'border-purple-650 text-purple-655 dark:border-purple-400 dark:text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
        >
          <Award className="w-4 h-4" />
          Achievements ({profile.achievements.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="px-5 py-4 flex-1 flex flex-col mx-5">
        {activeTab === 'posts' && (
          <>
            {posts.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-medium bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                No published sparks found.
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
                {posts.map(post => {
                  const dateStr = post.created_at.includes('-')
                    ? new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : post.created_at;
                  return (
                    <PostCard
                      key={post.id}
                      postId={post.id}
                      avatarUrl={profile.avatar_url}
                      username={profile.username}
                      displayName={profile.display_name}
                      title={post.title}
                      body={post.body}
                      mediaUrls={post.image_url ? [post.image_url, ...post.media_urls] : post.media_urls}
                      timestamp={dateStr}
                      likesCount={(post as any).likes_count !== undefined ? (post as any).likes_count : 15}
                      commentsCount={(post as any).comments_count !== undefined ? (post as any).comments_count : 3}
                      status={post.status}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'achievements' && (
          <>
            {profile.achievements.length === 0 ? (
              <div className="py-16 text-center text-slate-450 text-xs font-medium bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                No achievements recorded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {profile.achievements.map((badge) => (
                  <div
                    key={badge.id}
                    className={`flex items-start gap-4 p-4 rounded-2xl border shadow-sm transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${getBadgeStyle(badge.badge_type)}`}
                  >
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800/40 flex-shrink-0">
                      {getBadgeIcon(badge.badge_type)}
                    </div>
                    <div className="flex flex-col text-left justify-start gap-0.5">
                      <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                        {badge.title}
                      </span>
                      <span className="text-[11px] opacity-90 leading-relaxed font-medium">
                        {badge.description}
                      </span>
                      <span className="text-[9px] opacity-75 flex items-center gap-1 mt-1.5 font-bold uppercase tracking-wider">
                        <Calendar className="w-3 h-3" />
                        Earned {new Date(badge.earned_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl overflow-y-auto max-h-[90vh] shadow-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-4 animate-[scaleUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-extrabold text-slate-900 dark:text-slate-50 text-base">
                Edit Profile
              </span>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-205 transition-all duration-300 ease-spring hover:scale-110 active:scale-90 p-1 focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 text-left">
              {/* Profile Image Uploader */}
              <div className="flex flex-col items-center gap-2 mb-2">
                <div className="relative group w-20 h-20 rounded-full overflow-hidden border-2 border-purple-500 shadow-md">
                  {uploadingAvatar ? (
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-white animate-spin" />
                    </div>
                  ) : editAvatar ? (
                    <img
                      src={editAvatar}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-200 dark:bg-slate-850 flex items-center justify-center text-xs font-bold text-slate-550">
                      SP
                    </div>
                  )}
                  <label
                    htmlFor="edit-avatar-file"
                    className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-bold"
                  >
                    <Camera className="w-4 h-4 mb-0.5" />
                    <span>Upload</span>
                  </label>
                </div>
                <input
                  type="file"
                  id="edit-avatar-file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploadingAvatar}
                />
                <span className="text-[10px] font-semibold text-slate-400">Click picture to change</span>
                {uploadError && (
                  <span className="text-[10px] text-red-500 font-bold mt-1 text-center">⚠️ {uploadError}</span>
                )}
              </div>

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

              {/* Interests & Hobbies Selection */}
              <div className="flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-2xl border border-slate-150 dark:border-slate-800/60 max-h-[160px] overflow-y-auto text-left">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
                  Interests & Hobbies
                </span>
                
                {/* Sports */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-bold text-slate-400 dark:text-slate-550 pl-1 uppercase font-black">Sports</span>
                  <div className="flex flex-wrap gap-1">
                    {INTEREST_CATEGORIES.sports.map((tag) => {
                      const isSelected = editInterests.includes(tag.value);
                      return (
                        <button
                          key={tag.value}
                          type="button"
                          onClick={() => handleEditTagClick(tag.value)}
                          className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold transition-all duration-200 ${
                            isSelected
                              ? 'bg-purple-650 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-605 dark:text-slate-405 hover:border-purple-305 dark:hover:border-purple-800'
                          }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cultural */}
                <div className="flex flex-col gap-1 mt-1.5">
                  <span className="text-[8px] font-bold text-slate-400 dark:text-slate-550 pl-1 uppercase font-black">Cultural</span>
                  <div className="flex flex-wrap gap-1">
                    {INTEREST_CATEGORIES.cultural.map((tag) => {
                      const isSelected = editInterests.includes(tag.value);
                      return (
                        <button
                          key={tag.value}
                          type="button"
                          onClick={() => handleEditTagClick(tag.value)}
                          className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold transition-all duration-200 ${
                            isSelected
                              ? 'bg-purple-650 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-605 dark:text-slate-405 hover:border-purple-305 dark:hover:border-purple-800'
                          }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Other */}
                <div className="flex flex-col gap-1 mt-1.5">
                  <span className="text-[8px] font-bold text-slate-400 dark:text-slate-555 pl-1 uppercase font-black">Other</span>
                  <div className="flex flex-wrap gap-1">
                    {INTEREST_CATEGORIES.other.map((tag) => {
                      const isSelected = editInterests.includes(tag.value);
                      return (
                        <button
                          key={tag.value}
                          type="button"
                          onClick={() => handleEditTagClick(tag.value)}
                          className={`px-2.5 py-0.5 rounded-full text-[9px] font-semibold transition-all duration-200 ${
                            isSelected
                              ? 'bg-purple-650 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-605 dark:text-slate-405 hover:border-purple-305 dark:hover:border-purple-800'
                          }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Avatar Url */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                  Or Paste Avatar Image URL
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
                disabled={isSaving || uploadingAvatar}
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
