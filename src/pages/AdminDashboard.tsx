import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Database } from '../types/database';
import { Check, X, ShieldAlert, RefreshCw, AlertCircle, AlertTriangle, Zap } from 'lucide-react';
import { computeHeuristicScore, getRiskColor, getRiskBg, getRiskLabel, ModerationScore } from '../lib/moderation';


type DBPost = Database['public']['Tables']['posts']['Row'];
type DBProfile = Database['public']['Tables']['profiles']['Row'];

interface PostWithAuthor extends DBPost {
  author: DBProfile | null;
}

interface AdminDashboardProps {
  onRedirectToHome?: () => void;
  userEmail?: string;
}

// Initial mock pending posts for role simulator
const INITIAL_MOCK_PENDING: PostWithAuthor[] = [
  {
    id: 'mock-pending-1',
    author_id: 'user-3',
    title: '⚠️ Unmoderated Post about Crypto Scams',
    body: 'Earn $5000 a day guaranteed by joining this new Telegram channel! Not financial advice but totally legit guys, check it out now.',
    media_urls: ['https://images.unsplash.com/photo-1621761191319-c6fb62004040?q=80&w=600&auto=format&fit=crop'],
    image_url: null,
    status: 'pending',
    rejection_reason: null,
    is_nsfw: false,
    is_pinned: false,
    deleted_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    updated_at: new Date().toISOString(),
    published_at: null,
    author: {
      id: 'user-3',
      user_id: 'user-3-uuid',
      username: 'crypto_bob',
      display_name: 'Bob Spammer',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop',
      bio: 'Get rich quick.',
      interests: [],
      role: 'user',
      is_suspended: false,
      suspension_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }
  },
  {
    id: 'mock-pending-2',
    author_id: 'user-4',
    title: '📸 Beautiful sunset in Kyoto',
    body: 'Missing the calming streets of Gion, Kyoto. Can\'t wait to go back next year!',
    media_urls: ['https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=600&auto=format&fit=crop'],
    image_url: null,
    status: 'pending',
    rejection_reason: null,
    is_nsfw: false,
    is_pinned: false,
    deleted_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    updated_at: new Date().toISOString(),
    published_at: null,
    author: {
      id: 'user-4',
      user_id: 'user-4-uuid',
      username: 'travel_bug',
      display_name: 'Elena Rostova',
      avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=150&auto=format&fit=crop',
      bio: 'Photographer & wanderer.',
      interests: [],
      role: 'user',
      is_suspended: false,
      suspension_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }
  }
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onRedirectToHome, userEmail }) => {
  const [currentUserRole, setCurrentUserRole] = useState<'user' | 'moderator' | 'admin'>('moderator');
  const [pendingPosts, setPendingPosts] = useState<PostWithAuthor[]>([]);
  const [riskScores, setRiskScores] = useState<Record<string, ModerationScore>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);


  // Check database configuration
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  // Load user role and initial queue
  useEffect(() => {
    async function initDashboard() {
      setLoading(true);
      setErrorMsg(null);

      if (!isSupabaseConfigured) {
        // Simulation mode
        const mockEmail = userEmail || '';
        const whitelistedMails = [
          'admin1@stbrittosacademy.edu.in',
          'admin2@stbrittosacademy.edu.in',
          'gopinath.r@stbrittosacademy.edu.in',
          'sandbox@stbrittosacademy.edu.in'
        ];
        const isSimulatedAdmin = whitelistedMails.includes(mockEmail.toLowerCase());
        
        if (!isSimulatedAdmin) {
          console.warn('Access denied in simulation. Redirecting...');
          setCurrentUserRole('user');
          setLoading(false);
          onRedirectToHome?.();
          return;
        }

        setCurrentUserRole('admin');
        const posts = INITIAL_MOCK_PENDING;
        setPendingPosts(posts);
        // Compute risk scores for mock posts
        const scores: Record<string, ModerationScore> = {};
        posts.forEach(p => { scores[p.id] = computeHeuristicScore(p.title, p.body); });
        setRiskScores(scores);
        setLoading(false);
        return;

      }

      try {
        // Fetch current user profile role
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          setErrorMsg('Authentication required.');
          setCurrentUserRole('user');
          setLoading(false);
          return;
        }

        // Verify admin access using the is_admin() RPC hook
        const { data: isAdminResult, error: rpcError } = await supabase.rpc('is_admin');
        if (rpcError || !isAdminResult) {
          console.warn('Access denied. RPC is_admin() returned false or errored.');
          setCurrentUserRole('user');
          setLoading(false);
          onRedirectToHome?.();
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (profileError || !profile) {
          // If whitelisted, fallback to admin role
          setCurrentUserRole('admin');
        } else {
          // If the profile says 'user' but they passed the is_admin() check, promotion is implied.
          // Fallback to 'admin' to prevent incorrect client-side redirection.
          const resolvedRole = profile.role === 'user' ? 'admin' : profile.role;
          setCurrentUserRole(resolvedRole);
        }

        // Fetch pending posts for whitelisted moderator/admin
        await fetchPendingQueue();
      } catch (err: any) {
        setErrorMsg(err.message || 'An error occurred during verification.');
        setLoading(false);
      }
    }

    initDashboard();
  }, [isSupabaseConfigured, userEmail, onRedirectToHome]);

  // Client-side access guard: redirect if user is not a moderator
  useEffect(() => {
    if (currentUserRole === 'user' && !loading) {
      console.warn('Access denied. Redirecting to Home feed.');
      onRedirectToHome?.();
    }
  }, [currentUserRole, loading, onRedirectToHome]);

  // Real-time subscription hook
  useEffect(() => {
    if (!isSupabaseConfigured || currentUserRole === 'user') return;

    const postsChannel = supabase
      .channel('realtime-moderation-queue')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        async (payload) => {
          console.log('Realtime update received:', payload);
          await fetchPendingQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
    };
  }, [isSupabaseConfigured, currentUserRole]);

  const fetchPendingQueue = async () => {
    try {
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
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map((post: any) => ({
        ...post,
        author: Array.isArray(post.author) ? post.author[0] : post.author
      })) as PostWithAuthor[];

      setPendingPosts(formatted);

      // Compute ML risk scores for all fetched posts
      const scores: Record<string, ModerationScore> = {};
      formatted.forEach(p => { scores[p.id] = computeHeuristicScore(p.title, p.body); });
      setRiskScores(scores);

    } catch (err: any) {
      console.error('Error fetching queue:', err.message);
      setErrorMsg('Failed to update the queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (postId: string, action: 'approved' | 'rejected') => {
    setActionInProgress(postId);

    if (!isSupabaseConfigured) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setPendingPosts(prev => prev.filter(post => post.id !== postId));
      setActionInProgress(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: action })
        .eq('id', postId);

      if (error) throw error;
      setPendingPosts(prev => prev.filter(post => post.id !== postId));
    } catch (err: any) {
      alert(`Moderation action failed: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  if (currentUserRole === 'user' && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 py-24 text-center">
        <ShieldAlert className="w-10 h-10 text-red-500 mb-2 animate-bounce" />
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Redirecting to home...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-6xl bg-slate-50 dark:bg-slate-950 min-h-screen pb-24 md:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/40 px-5 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
            Moderator Queue
          </h1>
          <span className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
            Platform Guard
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Simulated role selector for early testing & demo */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Simulate:</span>
            <select
              value={currentUserRole}
              onChange={(e) => setCurrentUserRole(e.target.value as any)}
              className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
              <option value="user">User (Redirect)</option>
            </select>
          </div>

          {isSupabaseConfigured && (
            <button
              onClick={() => { setLoading(true); fetchPendingQueue(); }}
              className="p-1.5 text-slate-400 hover:text-slate-650"
              aria-label="Refresh queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main dashboard content */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mb-2" />
            <span className="text-xs font-semibold">Loading queue items...</span>
          </div>
        ) : errorMsg ? (
          <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-start gap-2.5 text-xs text-left">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold">Error</p>
              <p className="opacity-90 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        ) : pendingPosts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 py-24 text-slate-400 gap-3">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-300">
              Queue Clear!
            </h2>
            <p className="text-xs max-w-xs leading-relaxed">
              All submitted posts have been reviewed. Good job keeping the community safe!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1 text-left">
              Awaiting Review ({pendingPosts.length})
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {pendingPosts.map(post => (
              <div 
                key={post.id} 
                className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800/40 p-4 flex flex-col gap-3 relative transition-all duration-300 hover:shadow-md"
              >
                {/* Author Info */}
                <div className="flex items-center gap-2.5">
                  {post.author?.avatar_url ? (
                    <img 
                      src={post.author.avatar_url} 
                      alt="avatar" 
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-850 flex items-center justify-center font-bold text-xs text-slate-500">
                      {post.author?.username?.slice(0,2).toUpperCase() || 'AN'}
                    </div>
                  )}
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {post.author?.display_name || post.author?.username}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      @{post.author?.username} • today
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-1 text-left">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    {post.title}
                  </h3>
                  <p className="text-xs text-slate-650 dark:text-slate-350 leading-relaxed whitespace-pre-line">
                    {post.body}
                  </p>
                </div>

                {/* ML Risk Score Badge */}
                {riskScores[post.id] && (
                  <div className={`flex items-start gap-2.5 p-3 rounded-2xl border text-left ${getRiskBg(riskScores[post.id].level)}`}>
                    <div className="flex-shrink-0 mt-0.5">
                      {riskScores[post.id].level === 'high' ? (
                        <AlertTriangle className={`w-4 h-4 ${getRiskColor(riskScores[post.id].level)}`} />
                      ) : riskScores[post.id].level === 'medium' ? (
                        <Zap className={`w-4 h-4 ${getRiskColor(riskScores[post.id].level)}`} />
                      ) : (
                        <Check className={`w-4 h-4 ${getRiskColor(riskScores[post.id].level)}`} />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-extrabold ${getRiskColor(riskScores[post.id].level)}`}>
                          {getRiskLabel(riskScores[post.id].level)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Score: {(riskScores[post.id].score * 100).toFixed(0)}% · {riskScores[post.id].source}
                        </span>
                      </div>
                      {riskScores[post.id].flags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {riskScores[post.id].flags.map((flag, i) => (
                            <span key={i} className="text-[9px] bg-white/60 dark:bg-slate-900/40 border border-current/20 px-2 py-0.5 rounded-full font-semibold opacity-80">
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Auto-escalation warning */}
                {riskScores[post.id]?.level === 'high' && (
                  <div className="flex items-center gap-2 bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400">⚠️ Auto-escalated for senior review — high-risk content detected</span>
                  </div>
                )}

                {/* Post Media Preview */}

                {(post.image_url || (post.media_urls && post.media_urls.length > 0)) && (
                  <div className="w-full aspect-video rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950">
                    <img 
                      src={post.image_url || post.media_urls[0]} 
                      alt="preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Actions Overlay / Loader */}
                {actionInProgress === post.id ? (
                  <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 flex items-center justify-center rounded-3xl z-10 backdrop-blur-[1px]">
                    <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : (
                  /* Action Buttons Row */
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      onClick={() => handleAction(post.id, 'approved')}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 active:scale-[0.98] text-emerald-600 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 dark:text-emerald-400 rounded-2xl text-xs font-bold transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>

                    <button
                      onClick={() => handleAction(post.id, 'rejected')}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-red-50 hover:bg-red-100 active:scale-[0.98] text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-2xl text-xs font-bold transition-all"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
