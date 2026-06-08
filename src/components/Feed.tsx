import React, { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { PostCard } from './PostCard';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { fetchPosts } from '../lib/api';

export interface FeedProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigateToAdmin?: () => void;
  onSelectUser?: (username: string) => void;
  onOpenNotifications?: () => void;
  onOpenMessages?: () => void;
  currentProfileId: string | null;
  feedRefetchTrigger?: number;
  unreadNotifCount?: number;
  unreadMsgCount?: number;
  onCreatePost?: () => void;
}

export const Feed: React.FC<FeedProps> = (props) => {
  const {
    onSelectUser,
    currentProfileId,
    feedRefetchTrigger,
    onCreatePost,
  } = props;

  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!currentProfileId) return;
      const isSupabaseConfigured =
        import.meta.env.VITE_SUPABASE_URL &&
        import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';
      if (!isSupabaseConfigured) {
        const mockProfile = currentProfileId === 'auth-1' ? {
          username: 'spark_team',
          display_name: 'Spark Team',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop'
        } : {
          username: 'alex_dev',
          display_name: 'Alex Rivera',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop'
        };
        if (active) setCurrentUserProfile(mockProfile);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url')
          .eq('id', currentProfileId)
          .single();
        if (!error && data && active) {
          setCurrentUserProfile(data);
        }
      } catch (e) {
        console.error('Error loading current profile in Feed:', e);
      }
    }
    loadProfile();
    return () => { active = false; };
  }, [currentProfileId]);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['posts', currentProfileId],
    queryFn: ({ pageParam = 0 }) => fetchPosts(pageParam as number, currentProfileId, 5),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      return lastPage.length === 5 ? (lastPageParam as number) + 1 : undefined;
    },
  });

  useEffect(() => {
    if (feedRefetchTrigger !== undefined && feedRefetchTrigger > 0) {
      refetch();
    }
  }, [feedRefetchTrigger, refetch]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderSkeletons = () => (
    <div className="flex flex-col gap-4 w-full animate-pulse px-4">
      {[1, 2].map(n => (
        <div key={n} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/40">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-16 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
          <div className="w-3/4 h-4 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
          <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
          <div className="w-full aspect-video bg-slate-100 dark:bg-slate-950 rounded-2xl" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col items-center w-full">
      {/* Sticky Glassmorphic Header */}
      <header className="sticky top-0 z-40 w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/40 px-5 py-4.5 flex items-center justify-between shadow-sm">
        <h2 className="text-xl font-black text-slate-950 dark:text-slate-50 tracking-tight">
          Home Feed
        </h2>
        <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1.5 rounded-xl uppercase tracking-wider">
          ✨ Academic Hub
        </span>
      </header>

      {/* Feed list */}
      <div className="w-full px-4 flex flex-col gap-4 max-w-2xl mt-4">
        {/* Start a Spark Composer Box */}
        {onCreatePost && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {currentUserProfile?.avatar_url ? (
                <img
                  src={currentUserProfile.avatar_url}
                  alt="My Avatar"
                  className="w-10 h-10 rounded-full object-cover border border-slate-100 dark:border-slate-800"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-500">
                  {currentUserProfile?.display_name?.slice(0, 2).toUpperCase() || 'SP'}
                </div>
              )}
              <button
                onClick={onCreatePost}
                className="flex-grow text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900/80 border border-slate-200 dark:border-slate-800/60 rounded-full text-xs font-semibold text-slate-400 dark:text-slate-500 transition-colors focus:outline-none"
              >
                Start a spark...
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-850 pt-2 px-1">
              <button
                onClick={onCreatePost}
                className="flex items-center gap-2 px-3 py-2 text-xs font-extrabold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors focus:outline-none"
              >
                <span className="text-emerald-500 text-sm">📸</span>
                <span>Photo</span>
              </button>
              <button
                onClick={onCreatePost}
                className="flex items-center gap-2 px-3 py-2 text-xs font-extrabold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors focus:outline-none"
              >
                <span className="text-amber-500 text-sm">🎥</span>
                <span>Video</span>
              </button>
              <button
                onClick={onCreatePost}
                className="flex items-center gap-2 px-3 py-2 text-xs font-extrabold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors focus:outline-none"
              >
                <span className="text-indigo-500 text-sm">📅</span>
                <span>Event</span>
              </button>
              <button
                onClick={onCreatePost}
                className="flex items-center gap-2 px-3 py-2 text-xs font-extrabold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors focus:outline-none"
              >
                <span className="text-orange-500 text-sm">📝</span>
                <span>Write article</span>
              </button>
            </div>
          </div>
        )}

        {status === 'pending' && renderSkeletons()}

        {status === 'error' && (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <p className="text-slate-800 dark:text-slate-200 font-bold">Failed to load posts</p>
            <p className="text-xs text-slate-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        )}

        {status === 'success' && (
          <>
            {data.pages.flatMap(page => page).map((post, idx) => {
              const dateStr = post.created_at.includes('-')
                ? new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : post.created_at;
              return (
                <PostCard
                  key={post.id}
                  postId={post.id}
                  avatarUrl={post.author?.avatar_url}
                  username={post.author?.username || 'anonymous'}
                  displayName={post.author?.display_name}
                  title={post.title}
                  body={post.body}
                  mediaUrls={post.image_url ? [post.image_url, ...post.media_urls] : post.media_urls}
                  timestamp={dateStr}
                  likesCount={idx === 0 ? 42 : 15}
                  commentsCount={idx === 0 ? 8 : 3}
                  onAvatarClick={onSelectUser}
                  status={post.status}
                />
              );
            })}

            {/* Load more element */}
            <div ref={loadMoreRef} className="w-full flex justify-center py-4">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                  <span>Loading more posts...</span>
                </div>
              ) : hasNextPage ? (
                <span className="text-[11px] text-slate-400">Scroll down to load more</span>
              ) : (
                <div className="flex flex-col items-center gap-1 py-4 text-slate-400">
                  <Sparkles className="w-5 h-5 text-purple-500/60" />
                  <span className="text-xs font-semibold">You're all caught up!</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
