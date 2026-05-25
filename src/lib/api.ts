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
