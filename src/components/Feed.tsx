import React, { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { PostCard } from './PostCard';
import { SparkLogo } from './SparkLogo';
import { Database } from '../types/database';
import { AlertTriangle, RefreshCw, Sparkles, Bell, Heart, ShieldAlert } from 'lucide-react';

type DBPost = Database['public']['Tables']['posts']['Row'];
type DBProfile = Database['public']['Tables']['profiles']['Row'];

interface PostWithAuthor extends DBPost {
  author: DBProfile | null;
}

const PAGE_SIZE = 5;

// Mock posts specifically matching the user's design image
const MOCK_POSTS: PostWithAuthor[] = [
  {
    id: '1',
    author_id: 'auth-1',
    title: 'Welcome to Spark Social Feed (Page 1)',
    body: 'We are thrilled to launch the new Spark App feed. This interface is built with React, TypeScript, and Tailwind CSS. Double tap cards to like, and experience smooth interactions. Enjoy the glassmorphic aesthetics!',
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
    author: {
      id: 'auth-1',
      user_id: 'user-1',
      username: 'spark_team',
      display_name: 'Spark Team',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop',
      bio: 'Spark core developers.',
      role: 'admin',
      is_suspended: false,
      suspension_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }
  },
  {
    id: '2',
    author_id: 'auth-2',
    title: 'Frontend Optimization with Tailwind & Vite',
    body: 'Just finished profiling our bundle sizes. By utilizing postCSS, Autoprefixer, and Vite path aliases, we kept our bundle sizes incredibly small while building custom glassmorphism styles directly in tailwind.css.',
    media_urls: [],
    image_url: null,
    status: 'approved',
    rejection_reason: null,
    is_nsfw: false,
    is_pinned: false,
    deleted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    author: {
      id: 'auth-2',
      user_id: 'user-2',
      username: 'spark_team',
      display_name: 'Alex Rivera',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
      bio: 'Frontend Engineer @ Spark.',
      role: 'user',
      is_suspended: false,
      suspension_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }
  }
];

const fetchPostsPage = async (pageParam: number): Promise<PostWithAuthor[]> => {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 600));
    if (pageParam >= 3) return [];
    
    return MOCK_POSTS.map((post, idx) => ({
      ...post,
      id: `mock-${pageParam}-${idx}`,
      title: pageParam === 0 ? post.title : `${post.title} (Page ${pageParam + 1})`,
      created_at: 'today'
    }));
  }

  const from = pageParam * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles (
        id,
        user_id,
        username,
        display_name,
        avatar_url,
        bio,
        role,
        is_suspended,
        suspension_reason,
        created_at,
        updated_at,
        deleted_at
      )
    `)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((post: any) => ({
    ...post,
    author: Array.isArray(post.author) ? post.author[0] : post.author
  })) as PostWithAuthor[];
};

export interface FeedProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigateToAdmin?: () => void;
  onSelectUser?: (username: string) => void;
  onOpenNotifications?: () => void;
  onOpenActivity?: () => void;
  onOpenMessages?: () => void;
}

export const Feed: React.FC<FeedProps> = ({ 
  theme,
  onToggleTheme,
  onNavigateToAdmin,
  onSelectUser,
  onOpenNotifications,
  onOpenActivity,
  onOpenMessages
}) => {
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
    queryKey: ['approved_posts'],
    queryFn: ({ pageParam = 0 }) => fetchPostsPage(pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      return lastPage.length === MOCK_POSTS.length ? (lastPageParam as number) + 1 : undefined;
    },
  });

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
      {/* Fixed Sticky Glassmorphic Header */}
      <header className="sticky top-0 z-50 w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/40 px-5 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5 animate-fade-in">
          <SparkLogo size={32} className="relative top-[-1px]" />
          <span className="text-3.5xl font-black text-[#D946EF] dark:text-[#E879F9] tracking-tighter font-sans select-none bg-gradient-to-r from-pink-500 to-fuchsia-600 bg-clip-text text-transparent">
            Spark
          </span>
        </div>
        
        {/* Header Icons on Top-Right */}
        <div className="flex items-center gap-4 text-slate-850 dark:text-slate-200">
          {/* Theme switcher */}
          <button
            onClick={onToggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 transition-all duration-300 ease-spring active:scale-90 text-slate-700 dark:text-slate-300 focus:outline-none"
            aria-label="Toggle Theme"
            title="Toggle Dark/Light Mode"
          >
            {theme === 'dark' ? (
              <svg className="w-5.5 h-5.5 text-amber-500 fill-amber-500/20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
            ) : (
              <svg className="w-5.5 h-5.5 text-indigo-600 fill-indigo-600/10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>

          {/* Moderator Guard shortcut icon */}
          {onNavigateToAdmin && (
            <button 
              onClick={onNavigateToAdmin} 
              className="text-[#7C3AED] dark:text-[#A78BFA] hover:scale-110 active:scale-95 transition-all duration-300 ease-spring" 
              aria-label="Moderator Queue"
              title="Moderator Dashboard"
            >
              <ShieldAlert className="w-[26px] h-[26px]" strokeWidth={1.5} />
            </button>
          )}

          <button 
            onClick={onOpenNotifications}
            className="hover:text-purple-600 hover:scale-110 active:scale-95 transition-all duration-300 ease-spring focus:outline-none" 
            aria-label="Notifications"
          >
            <Bell className="w-[26px] h-[26px]" strokeWidth={1.5} />
          </button>
          
          <button 
            onClick={onOpenActivity}
            className="hover:text-purple-600 hover:scale-110 active:scale-95 transition-all duration-300 ease-spring focus:outline-none" 
            aria-label="Activity"
          >
            <Heart className="w-[26px] h-[26px]" strokeWidth={1.5} />
          </button>
          
          <button 
            onClick={onOpenMessages}
            className="hover:text-purple-600 hover:scale-110 active:scale-95 transition-all duration-300 ease-spring focus:outline-none" 
            aria-label="Direct Messages"
          >
            {/* Messenger Chat Icon */}
            <svg 
              viewBox="0 0 24 24" 
              width="26" 
              height="26" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              fill="none" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="transform rotate-[-5deg]"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              <path d="M13 8.5l-4 5.5 2.5-2 1.5 2 4-5.5-2.5 2-1.5-2z" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
      </header>

      {/* Feed list */}
      <div className="w-full px-4 flex flex-col gap-4 max-w-md mt-4">
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
              const dateStr = post.created_at === 'today' ? 'today' : 'today';
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
