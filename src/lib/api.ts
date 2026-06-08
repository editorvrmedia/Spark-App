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
  },
  j_vane: {
    id: 'auth-j_vane',
    user_id: 'user-j_vane',
    username: 'j_vane',
    display_name: 'Julian Vane',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
    bio: 'Interaction Designer',
    role: 'user',
    is_suspended: false,
    suspension_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    achievements: []
  },
  elena_dev: {
    id: 'auth-elena_dev',
    user_id: 'user-elena_dev',
    username: 'elena_dev',
    display_name: 'Elena Stark',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop',
    bio: 'Fullstack Architect',
    role: 'user',
    is_suspended: false,
    suspension_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    achievements: []
  },
  sarah_c: {
    id: 'auth-sarah_c',
    user_id: 'user-sarah_c',
    username: 'sarah_c',
    display_name: 'Sarah Chen',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop',
    bio: 'AI Researcher',
    role: 'user',
    is_suspended: false,
    suspension_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    achievements: []
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
    author_id: 'auth-j_vane',
    title: 'Working on a new mental model for distributed systems.',
    body: 'The idea is to treat individual micro services as autonomous neurons that fire only when data threshold is met. Efficiency +140%.',
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
    author: MOCK_PROFILES['j_vane'] as any,
    likes_count: 1200,
    comments_count: 42
  } as any,
  {
    id: 'mock-post-2',
    author_id: 'auth-elena_dev',
    title: 'Check out this cleaner way to handle async state in React with custom hooks.',
    body: "Reduces boilerplate by 60%.\n\n```typescript\nconst useAsync = (task) => {\n  const [state, setState] = useState('idle');\n  const execute = async () => {\n    setState('loading');\n    try {\n      await task();\n      setState('success');\n    } catch (e) {\n      setState('error');\n    }\n  };\n  return { state, execute };\n};\n```",
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
    author: MOCK_PROFILES['elena_dev'] as any,
    likes_count: 840,
    comments_count: 18
  } as any,
  {
    id: 'mock-post-3',
    author_id: 'auth-sarah_c',
    title: "The future of design isn't interfaces, it's intent orchestration.",
    body: '',
    media_urls: ['https://images.unsplash.com/photo-1496181130204-755241524eab?q=80&w=800&auto=format&fit=crop'],
    image_url: null,
    status: 'approved',
    rejection_reason: null,
    is_nsfw: false,
    is_pinned: false,
    deleted_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    author: MOCK_PROFILES['sarah_c'] as any,
    likes_count: 4200,
    comments_count: 156
  } as any
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

// =============================================================================
// Notifications API
// =============================================================================

export interface AppNotification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: 'like' | 'comment' | 'follow' | 'post_approved' | 'post_rejected';
  post_id: string | null;
  message: string | null;
  read: boolean;
  created_at: string;
  actor?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    recipient_id: 'auth-2',
    actor_id: 'auth-1',
    type: 'follow',
    post_id: null,
    message: '@spark_team started following you.',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    actor: { username: 'spark_team', display_name: 'Spark Team', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop' }
  },
  {
    id: 'notif-2',
    recipient_id: 'auth-2',
    actor_id: 'auth-1',
    type: 'like',
    post_id: 'mock-post-2',
    message: '@spark_team liked your spark.',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    actor: { username: 'spark_team', display_name: 'Spark Team', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop' }
  },
  {
    id: 'notif-3',
    recipient_id: 'auth-2',
    actor_id: null,
    type: 'post_approved',
    post_id: 'mock-post-2',
    message: 'Your spark was approved and is now live!',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    actor: null
  }
];

export async function fetchNotifications(profileId: string): Promise<AppNotification[]> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 250));
    return MOCK_NOTIFICATIONS.filter(n => n.recipient_id === profileId);
  }

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      actor:profiles!actor_id (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('recipient_id', profileId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []).map((n: any) => ({
    ...n,
    actor: Array.isArray(n.actor) ? n.actor[0] : n.actor
  })) as AppNotification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    const n = MOCK_NOTIFICATIONS.find(n => n.id === notificationId);
    if (n) n.read = true;
    return;
  }

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsRead(profileId: string): Promise<void> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    MOCK_NOTIFICATIONS.forEach(n => { if (n.recipient_id === profileId) n.read = true; });
    return;
  }

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', profileId)
    .eq('read', false);
}

export function subscribeToNotifications(
  profileId: string,
  onNew: (notification: AppNotification) => void
) {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`notifications:${profileId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${profileId}`
      },
      (payload) => {
        onNew(payload.new as AppNotification);
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// =============================================================================
// Direct Messages API
// =============================================================================

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface Conversation {
  other_profile_id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

// In-memory mock DM store
const initMockDMs = (): DirectMessage[] => {
  const key = 'spark-mock-dms';
  const stored = sessionStorage.getItem(key);
  if (!stored) {
    const defaults: DirectMessage[] = [
      {
        id: 'dm-1',
        sender_id: 'auth-1',
        recipient_id: 'auth-2',
        body: 'Hey! Did you check out the new dark mode?',
        read: true,
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
      },
      {
        id: 'dm-2',
        sender_id: 'auth-2',
        recipient_id: 'auth-1',
        body: 'Yeah, looks super sleek! Glassmorphism overlays are 🔥',
        read: true,
        created_at: new Date(Date.now() - 1000 * 60 * 28).toISOString()
      },
      {
        id: 'dm-3',
        sender_id: 'auth-1',
        recipient_id: 'auth-2',
        body: 'Awesome! Let me know if you want to push notifications next.',
        read: false,
        created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString()
      }
    ];
    sessionStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }
  return JSON.parse(stored);
};

export async function fetchConversations(profileId: string): Promise<Conversation[]> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 250));
    const dms = initMockDMs();
    const partnerIds = new Set<string>();
    dms.forEach(dm => {
      if (dm.sender_id === profileId) partnerIds.add(dm.recipient_id);
      if (dm.recipient_id === profileId) partnerIds.add(dm.sender_id);
    });
    return Array.from(partnerIds).map(otherId => {
      const thread = dms.filter(
        dm => (dm.sender_id === profileId && dm.recipient_id === otherId) ||
              (dm.sender_id === otherId && dm.recipient_id === profileId)
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const unread = thread.filter(dm => dm.recipient_id === profileId && !dm.read).length;
      const partner = MOCK_PROFILES[otherId === 'auth-1' ? 'spark_team' : 'alex_dev'];
      return {
        other_profile_id: otherId,
        other_username: partner?.username || 'unknown',
        other_display_name: partner?.display_name || null,
        other_avatar_url: partner?.avatar_url || null,
        last_message: thread[0]?.body || '',
        last_message_at: thread[0]?.created_at || new Date().toISOString(),
        unread_count: unread
      };
    });
  }

  const { data, error } = await supabase.rpc('get_conversations', { p_profile_id: profileId });
  if (error) throw error;
  return (data || []) as Conversation[];
}

export async function fetchMessages(
  profileId: string,
  otherProfileId: string,
  limit = 50
): Promise<DirectMessage[]> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 200));
    const all = initMockDMs();
    return all.filter(
      dm => (dm.sender_id === profileId && dm.recipient_id === otherProfileId) ||
            (dm.sender_id === otherProfileId && dm.recipient_id === profileId)
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(
      `and(sender_id.eq.${profileId},recipient_id.eq.${otherProfileId}),and(sender_id.eq.${otherProfileId},recipient_id.eq.${profileId})`
    )
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as DirectMessage[];
}

export async function sendMessage(
  senderId: string,
  recipientId: string,
  body: string
): Promise<DirectMessage> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    await new Promise(resolve => setTimeout(resolve, 150));
    const all = initMockDMs();
    const newDM: DirectMessage = {
      id: `dm-${Date.now()}`,
      sender_id: senderId,
      recipient_id: recipientId,
      body: body.trim(),
      read: false,
      created_at: new Date().toISOString()
    };
    all.push(newDM);
    sessionStorage.setItem('spark-mock-dms', JSON.stringify(all));
    return newDM;
  }

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, body: body.trim() })
    .select()
    .single();

  if (error) throw error;
  return data as DirectMessage;
}

export async function markMessagesRead(profileId: string, otherProfileId: string): Promise<void> {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) {
    const all = initMockDMs();
    all.forEach(dm => {
      if (dm.sender_id === otherProfileId && dm.recipient_id === profileId) dm.read = true;
    });
    sessionStorage.setItem('spark-mock-dms', JSON.stringify(all));
    return;
  }

  await supabase
    .from('direct_messages')
    .update({ read: true })
    .eq('recipient_id', profileId)
    .eq('sender_id', otherProfileId)
    .eq('read', false);
}

export function subscribeToMessages(
  profileId: string,
  onNew: (message: DirectMessage) => void
) {
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`dms:${profileId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `recipient_id=eq.${profileId}`
      },
      (payload) => {
        onNew(payload.new as DirectMessage);
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

