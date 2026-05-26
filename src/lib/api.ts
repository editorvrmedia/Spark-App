import { supabase } from './supabaseClient';
import { Database } from '../types/database';

export type DBProfile = Database['public']['Tables']['profiles']['Row'];
export type DBAchievement = Database['public']['Tables']['achievements']['Row'];

export interface ProfileWithAchievements extends DBProfile {
  achievements: DBAchievement[];
}

const MOCK_PROFILES: Record<string, ProfileWithAchievements> = {
  alex_dev: {
    id: 'auth-2',
    user_id: 'user-2',
    username: 'alex_dev',
    display_name: 'Alex Rivera',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
    bio: 'Frontend Engineer @ Spark. Crafting clean, mobile-first social components with Tailwind CSS.',
    role: 'moderator',
    is_suspended: false,
    suspension_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    achievements: [
      {
        id: 'ach-1',
        profile_id: 'auth-2',
        badge_type: 'student_leader',
        title: 'Student Leader',
        description: 'Leads active campus and moderation flows.',
        earned_at: new Date().toISOString()
      },
      {
        id: 'ach-2',
        profile_id: 'auth-2',
        badge_type: 'contributor',
        title: 'Contributor',
        description: 'Actively publishes code and layout insights.',
        earned_at: new Date().toISOString()
      }
    ]
  },
  spark_team: {
    id: 'auth-1',
    user_id: 'user-1',
    username: 'spark_team',
    display_name: 'Spark Team',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop',
    bio: 'Spark core developers. We build components that connect people instantly.',
    role: 'admin',
    is_suspended: false,
    suspension_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    achievements: [
      {
        id: 'ach-3',
        profile_id: 'auth-1',
        badge_type: 'core_team',
        title: 'Core Team',
        description: 'Member of Spark primary builder team.',
        earned_at: new Date().toISOString()
      },
      {
        id: 'ach-4',
        profile_id: 'auth-1',
        badge_type: 'super_admin',
        title: 'Super Admin',
        description: 'Maintains full directory permissions.',
        earned_at: new Date().toISOString()
      }
    ]
  }
};

export async function fetchProfile(username: string): Promise<ProfileWithAchievements> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    // Simulator Mode
    await new Promise(resolve => setTimeout(resolve, 300));
    const normalized = username.toLowerCase();
    const profile = MOCK_PROFILES[normalized];
    if (!profile) {
      throw new Error(`Profile for user "${username}" not found in sandbox database.`);
    }
    return profile;
  }

  // Live Supabase Mode
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      achievements:achievements (*)
    `)
    .eq('username', username)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Map relations safely (resolving single/array responses in Supabase bindings)
  const profileData = data as any;
  return {
    ...profileData,
    achievements: Array.isArray(profileData.achievements)
      ? profileData.achievements
      : profileData.achievements
        ? [profileData.achievements]
        : []
  } as ProfileWithAchievements;
}

export async function toggleFollow(
  followerId: string,
  followingId: string,
  currentlyFollowing: boolean
): Promise<boolean> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    // Simulator Mode toggle response
    await new Promise(resolve => setTimeout(resolve, 300));
    return !currentlyFollowing;
  }

  // Call the atomically defined database-level toggle_follow RPC
  const { data, error } = await supabase.rpc('toggle_follow', {
    follower_id_param: followerId,
    following_id_param: followingId
  });

  if (error) throw error;
  return !!data;
}

// =============================================================================
// Interactions API Extension: Likes, Comments, and Bookmarks
// =============================================================================

export interface CommentWithAuthor {
  id: string;
  post_id: string;
  profile_id: string;
  body: string;
  created_at: string;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

// Session-based in-memory mock comments for offline sandbox simulation
const initMockComments = (): CommentWithAuthor[] => {
  const sessionKey = 'spark-mock-comments';
  const comments = sessionStorage.getItem(sessionKey);
  if (!comments) {
    const defaultComments: CommentWithAuthor[] = [
      {
        id: 'c-1',
        post_id: '1',
        profile_id: 'auth-2',
        body: 'Absolutely loving the new custom glassmorphism styling! Super clean! 🚀',
        created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        author: {
          username: 'alex_dev',
          display_name: 'Alex Rivera',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop'
        }
      },
      {
        id: 'c-2',
        post_id: '1',
        profile_id: 'auth-1',
        body: 'Thanks Alex! High-fidelity spring transitions are running smoothly too. Multiple images gallery is planned next.',
        created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        author: {
          username: 'spark_team',
          display_name: 'Spark Team',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop'
        }
      }
    ];
    sessionStorage.setItem(sessionKey, JSON.stringify(defaultComments));
    return defaultComments;
  }
  return JSON.parse(comments);
};

// 1. Likes
export async function toggleLike(postId: string, profileId: string, currentlyLiked: boolean): Promise<boolean> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return !currentlyLiked;
  }

  if (currentlyLiked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('profile_id', profileId);
    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase
      .from('likes')
      .insert({ post_id: postId, profile_id: profileId });
    if (error) throw error;
    return true;
  }
}

export async function fetchLikeStatus(postId: string, profileId: string): Promise<boolean> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    return true; // Default liked in layout screens
  }

  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .eq('post_id', postId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

// 2. Comments
export async function fetchComments(postId: string): Promise<CommentWithAuthor[]> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 200));
    const allComments = initMockComments();
    const cleanPostId = postId.includes('mock') ? '1' : postId;
    return allComments.filter(c => c.post_id === cleanPostId);
  }

  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((c: any) => ({
    ...c,
    author: Array.isArray(c.author) ? c.author[0] : c.author
  })) as CommentWithAuthor[];
}

export async function createComment(postId: string, profileId: string, body: string): Promise<CommentWithAuthor> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 250));
    const allComments = initMockComments();
    const cleanPostId = postId.includes('mock') ? '1' : postId;
    
    // Resolve user avatar
    const authorProfile = profileId === 'auth-1' ? MOCK_PROFILES['spark_team'] : MOCK_PROFILES['alex_dev'];

    const newComment: CommentWithAuthor = {
      id: `c-sim-${Date.now()}`,
      post_id: cleanPostId,
      profile_id: profileId,
      body: body.trim(),
      created_at: new Date().toISOString(),
      author: {
        username: authorProfile?.username || 'anonymous',
        display_name: authorProfile?.display_name || 'Anonymous Student',
        avatar_url: authorProfile?.avatar_url || null
      }
    };

    allComments.push(newComment);
    sessionStorage.setItem('spark-mock-comments', JSON.stringify(allComments));
    return newComment;
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      profile_id: profileId,
      body: body.trim()
    })
    .select(`
      *,
      author:profiles (
        username,
        display_name,
        avatar_url
      )
    `)
    .single();

  if (error) throw error;

  const formatted = data as any;
  return {
    ...formatted,
    author: Array.isArray(formatted.author) ? formatted.author[0] : formatted.author
  } as CommentWithAuthor;
}

// 3. Bookmarks
export async function toggleBookmark(postId: string, profileId: string, currentlyBookmarked: boolean): Promise<boolean> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return !currentlyBookmarked;
  }

  if (currentlyBookmarked) {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('post_id', postId)
      .eq('profile_id', profileId);
    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase
      .from('bookmarks')
      .insert({ post_id: postId, profile_id: profileId });
    if (error) throw error;
    return true;
  }
}

export async function fetchBookmarkStatus(postId: string, profileId: string): Promise<boolean> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    return true; // Default bookmarked in layout screens
  }

  const { data, error } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('post_id', postId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

// =============================================================================
// Posts API Extension: Fetching & Creating Posts
// =============================================================================

export type DBPost = Database['public']['Tables']['posts']['Row'];
export interface PostWithAuthor extends DBPost {
  author: DBProfile | null;
}

const DEFAULT_MOCK_POSTS: PostWithAuthor[] = [
  {
    id: 'mock-post-1',
    author_id: 'auth-1',
    title: 'Welcome to Spark Social Feed',
    body: 'We are thrilled to launch the new Spark App feed. This interface is built with React, TypeScript, and Tailwind CSS. Double tap cards to like, and experience smooth interactions. Enjoy the glassmorphic aesthetics!',
    media_urls: ['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop'],
    image_url: null,
    status: 'approved',
    rejection_reason: null,
    is_nsfw: false,
    is_pinned: true,
    deleted_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    author: MOCK_PROFILES['spark_team']
  },
  {
    id: 'mock-post-2',
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
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    author: MOCK_PROFILES['alex_dev']
  }
];

export const initMockPosts = (): PostWithAuthor[] => {
  const sessionKey = 'spark-mock-posts';
  const posts = sessionStorage.getItem(sessionKey);
  if (!posts) {
    sessionStorage.setItem(sessionKey, JSON.stringify(DEFAULT_MOCK_POSTS));
    return DEFAULT_MOCK_POSTS;
  }
  return JSON.parse(posts);
};

export async function fetchPosts(pageParam: number, currentProfileId: string | null, pageSize: number = 5): Promise<PostWithAuthor[]> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 400));
    const allPosts = initMockPosts();
    
    // Standard users see approved posts OR their own posts
    const filtered = allPosts.filter(post => 
      post.status === 'approved' || (currentProfileId && post.author_id === currentProfileId)
    );

    // Sort by created_at DESC
    const sorted = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Paginate
    const from = pageParam * pageSize;
    const to = from + pageSize;
    return sorted.slice(from, to);
  }

  const from = pageParam * pageSize;
  const to = from + pageSize - 1;

  let queryBuilder = supabase
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
    .is('deleted_at', null);

  if (currentProfileId) {
    queryBuilder = queryBuilder.or(`status.eq.approved,author_id.eq.${currentProfileId}`);
  } else {
    queryBuilder = queryBuilder.eq('status', 'approved');
  }

  const { data, error } = await queryBuilder
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((post: any) => ({
    ...post,
    author: Array.isArray(post.author) ? post.author[0] : post.author
  })) as PostWithAuthor[];
}

export async function createPost(
  title: string,
  body: string,
  imageUrl: string | null,
  mediaUrls: string[],
  authorProfileId: string
): Promise<PostWithAuthor> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const allPosts = initMockPosts();
    
    const authorProfile = authorProfileId === 'auth-1' ? MOCK_PROFILES['spark_team'] : MOCK_PROFILES['alex_dev'];

    const newPost: PostWithAuthor = {
      id: `mock-post-${Date.now()}`,
      author_id: authorProfileId,
      title: title.trim(),
      body: body.trim(),
      image_url: imageUrl,
      media_urls: mediaUrls,
      status: 'pending', // Lands as pending
      rejection_reason: null,
      is_nsfw: false,
      is_pinned: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: null,
      author: authorProfile || null
    };

    allPosts.unshift(newPost); // Add at top
    sessionStorage.setItem('spark-mock-posts', JSON.stringify(allPosts));
    return newPost;
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorProfileId,
      title: title.trim(),
      body: body.trim(),
      image_url: imageUrl,
      media_urls: mediaUrls,
      status: 'pending' // Lands as pending
    })
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
    .single();

  if (error) {
    throw error;
  }

  const formatted = data as any;
  return {
    ...formatted,
    author: Array.isArray(formatted.author) ? formatted.author[0] : formatted.author
  } as PostWithAuthor;
}
