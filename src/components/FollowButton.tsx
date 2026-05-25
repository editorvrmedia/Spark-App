import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toggleFollow } from '../lib/api';
import { UserPlus, UserMinus, RefreshCw } from 'lucide-react';

interface FollowButtonProps {
  targetProfileId: string;
  currentProfileId: string;
  onToggle?: (isFollowing: boolean) => void;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  targetProfileId,
  currentProfileId,
  onToggle,
}) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  // Check if current user is already following target user
  useEffect(() => {
    async function checkFollowStatus() {
      if (targetProfileId === currentProfileId) {
        setLoading(false);
        return; // Can't follow yourself
      }

      if (!isSupabaseConfigured) {
        // Simulation default state
        setIsFollowing(targetProfileId === 'auth-1'); // Assume we follow Spark Team in sandbox by default
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentProfileId)
          .eq('following_id', targetProfileId)
          .maybeSingle();

        if (!error && data) {
          setIsFollowing(true);
        } else {
          setIsFollowing(false);
        }
      } catch (err) {
        console.error('Error checking follow status:', err);
      } finally {
        setLoading(false);
      }
    }

    checkFollowStatus();
  }, [targetProfileId, currentProfileId, isSupabaseConfigured]);

  const handleFollowToggle = async () => {
    if (toggling || targetProfileId === currentProfileId) return;
    setToggling(true);

    try {
      // Leverage the toggleFollow API utility function
      const nextFollowState = await toggleFollow(currentProfileId, targetProfileId, isFollowing);
      setIsFollowing(nextFollowState);
      onToggle?.(nextFollowState);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <button 
        disabled
        className="px-4 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-full text-xs font-bold text-slate-400 flex items-center gap-1.5"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        Checking...
      </button>
    );
  }

  // Prevent showing Follow button on self profile
  if (targetProfileId === currentProfileId) {
    return null;
  }

  return (
    <button
      onClick={handleFollowToggle}
      disabled={toggling}
      className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-all active:scale-95 flex items-center gap-1.5 ${
        isFollowing
          ? 'bg-slate-150 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
          : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/10'
      }`}
    >
      {toggling ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserMinus className="w-3.5 h-3.5" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="w-3.5 h-3.5" />
          Follow
        </>
      )}
    </button>
  );
};
