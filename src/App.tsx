import { useState, useEffect } from 'react';
import { Feed } from './components/Feed';
import { AdminDashboard } from './pages/AdminDashboard';
import { Profile } from './pages/Profile';
import { Auth } from './pages/Auth';
import { CreatePost } from './components/CreatePost';
import { AppNavigation, NavTab } from './components/AppNavigation';
import { Search, LogOut, Loader2, X, Sparkles } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { ProfileOnboarding } from './components/ProfileOnboarding';

function App() {
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(true); // default to true in mock for sandbox simulation
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [viewedUsername, setViewedUsername] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('spark-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [feedRefetchTrigger, setFeedRefetchTrigger] = useState(0);

  // Explore search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTab, setSearchTab] = useState<'sparks' | 'students'>('sparks');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Overlay state: notifications, activity, messages
  const [activeOverlay, setActiveOverlay] = useState<'notifications' | 'activity' | 'messages' | null>(null);

  // Sync theme to root class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('spark-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Check database configuration
  const isSupabaseConfigured =
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';

  // Read active session on mount
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [isSupabaseConfigured]);

  // Fetch profile role and admin whitelist status upon session acquisition
  useEffect(() => {
    if (!isSupabaseConfigured || !session) {
      if (!session) {
        setIsAdmin(false);
        setCurrentProfileId(null);
      } else {
        const mockEmail = session.user?.email || '';
        const whitelistedMails = ['admin1@stbrittosacademy.edu.in', 'admin2@stbrittosacademy.edu.in'];
        setIsAdmin(whitelistedMails.includes(mockEmail.toLowerCase()));
        setCurrentProfileId('auth-2'); // default to alex_dev in mock sandbox
      }
      return;
    }

    async function loadRoleAndAdminStatus() {
      try {
        // Resolve profile ID and role
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('id, role, bio')
          .eq('user_id', session.user.id)
          .single();

        if (profileRow) {
          setCurrentProfileId(profileRow.id);
          setIsAdmin(profileRow.role === 'admin');

          const hasCompletedOnboarding = localStorage.getItem(`spark-onboarded-${profileRow.id}`);
          if (!profileRow.bio && !hasCompletedOnboarding) {
            setShowOnboarding(true);
          }
        } else {
          setCurrentProfileId(null);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Failed to load session profile role or admin status:', err);
        setIsAdmin(false);
        setCurrentProfileId(null);
      }
    }

    loadRoleAndAdminStatus();
  }, [session, isSupabaseConfigured]);

  // Perform Explore search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    let active = true;
    const query = searchQuery.trim().toLowerCase();

    async function runSearch() {
      setSearchLoading(true);
      try {
        if (!isSupabaseConfigured) {
          // Simulation search
          await new Promise(resolve => setTimeout(resolve, 300));
          if (!active) return;

          if (searchTab === 'sparks') {
            const mockSparks = [
              {
                id: '1',
                title: 'Welcome to Spark Social Feed',
                body: 'We are thrilled to launch the new Spark App feed. This interface is built with React, TypeScript, and Tailwind CSS. Enjoy the glassmorphic aesthetics!',
                created_at: new Date().toISOString(),
                author: { username: 'spark_team', display_name: 'Spark Team' }
              },
              {
                id: '2',
                title: 'Frontend Optimization with Tailwind & Vite',
                body: 'Just finished profiling our bundle sizes. By utilizing postCSS, Autoprefixer, and Vite path aliases, we kept our bundle sizes incredibly small.',
                created_at: new Date().toISOString(),
                author: { username: 'alex_dev', display_name: 'Alex Rivera' }
              }
            ];
            const filtered = mockSparks.filter(s => 
              s.title.toLowerCase().includes(query) || 
              s.body.toLowerCase().includes(query)
            );
            setSearchResults(filtered);
          } else {
            const mockStudents = [
              {
                id: 'auth-2',
                username: 'alex_dev',
                display_name: 'Alex Rivera',
                avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
                bio: 'Frontend Engineer @ Spark.'
              },
              {
                id: 'auth-1',
                username: 'spark_team',
                display_name: 'Spark Team',
                avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop',
                bio: 'Core developers.'
              }
            ];
            const filtered = mockStudents.filter(u => 
              u.username.toLowerCase().includes(query) || 
              u.display_name.toLowerCase().includes(query)
            );
            setSearchResults(filtered);
          }
        } else {
          // Live search in database
          if (searchTab === 'sparks') {
            const { data, error } = await supabase
              .from('posts')
              .select(`
                *,
                author:profiles (
                  username,
                  display_name,
                  avatar_url
                )
              `)
              .or(`body.ilike.%${query}%,title.ilike.%${query}%`)
              .eq('status', 'approved')
              .is('deleted_at', null)
              .limit(15);
            if (!error && data && active) {
              setSearchResults(
                data.map((p: any) => ({
                  ...p,
                  author: Array.isArray(p.author) ? p.author[0] : p.author
                }))
              );
            }
          } else {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
              .is('deleted_at', null)
              .limit(15);
            if (!error && data && active) {
              setSearchResults(data);
            }
          }
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        if (active) setSearchLoading(false);
      }
    }

    runSearch();
    return () => { active = false; };
  }, [searchQuery, searchTab, isSupabaseConfigured]);

  const handleTabChange = (tab: NavTab) => {
    if (tab === 'create') {
      setIsCreatePostOpen(true);
      return;
    }
    setViewedUsername(null);
    setActiveTab(tab);
  };

  const handleLogOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setSession(null);
  };

  // Render auth view if user is not signed in
  if (!session) {
    return (
      <Auth 
        onAuthSuccess={(sess, isNew) => {
          setSession(sess);
          if (isNew) {
            setShowOnboarding(true);
          }
        }} 
        onBypass={() => {
          setSession({ user: { email: 'sandbox@stbrittosacademy.edu.in' } });
          setShowOnboarding(true);
        }}
      />
    );
  }

  // Render onboarding wizard if showOnboarding is true
  if (showOnboarding) {
    return (
      <ProfileOnboarding 
        session={session} 
        currentProfileId={currentProfileId}
        onComplete={() => {
          if (currentProfileId) {
            localStorage.setItem(`spark-onboarded-${currentProfileId}`, 'true');
          }
          setShowOnboarding(false);
          setActiveTab('home');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center relative overflow-x-hidden">
      {/* Ambient background glow blobs */}
      <div className="ambient-blob w-[280px] h-[280px] bg-purple-500/10 dark:bg-purple-600/15 top-[-40px] left-[-60px] animate-drift-slow" />
      <div className="ambient-blob w-[320px] h-[320px] bg-pink-500/10 dark:bg-pink-600/15 bottom-[20%] right-[-80px] animate-drift-reverse-slow" />

      {/* Centered Scrollable Main Content */}
      <main className="flex-1 w-full max-w-md flex flex-col pb-24 z-10 relative">
        {viewedUsername ? (
          <Profile username={viewedUsername} onBack={() => setViewedUsername(null)} />
        ) : (
          <>
            {activeTab === 'home' && (
              <Feed 
                theme={theme}
                onToggleTheme={toggleTheme}
                onNavigateToAdmin={isAdmin ? () => handleTabChange('admin') : undefined} 
                onSelectUser={(username) => setViewedUsername(username)}
                onOpenNotifications={() => setActiveOverlay('notifications')}
                onOpenActivity={() => setActiveOverlay('activity')}
                onOpenMessages={() => setActiveOverlay('messages')}
                currentProfileId={currentProfileId}
                feedRefetchTrigger={feedRefetchTrigger}
              />
            )}
            {activeTab === 'admin' && (
              <AdminDashboard onRedirectToHome={() => handleTabChange('home')} userEmail={session?.user?.email} />
            )}
            {activeTab === 'profile' && <Profile username={null} />}
            {activeTab === 'explore' && (
              <div className="flex-1 flex flex-col w-full">
                {/* Explore Glassmorphic Header */}
                <header className="sticky top-0 z-50 w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/40 px-5 py-3.5 flex items-center justify-between shadow-sm">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                    Explore
                  </h1>
                  
                  {/* Theme toggle switch in header */}
                  <button
                    onClick={toggleTheme}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 transition-all duration-300 ease-spring active:scale-90 text-slate-700 dark:text-slate-350 focus:outline-none"
                    aria-label="Toggle Theme"
                    title="Toggle Dark/Light Mode"
                  >
                    {theme === 'dark' ? (
                      <svg className="w-5.5 h-5.5 text-amber-500 fill-amber-500/20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
                    ) : (
                      <svg className="w-5.5 h-5.5 text-indigo-600 fill-indigo-600/10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    )}
                  </button>
                </header>

                {/* Search Bar Input */}
                <div className="px-5 py-3.5">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={searchTab === 'sparks' ? "Search sparks by keyword..." : "Search students by name..."}
                      className="w-full bg-white dark:bg-slate-905/70 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 pl-10 pr-10 py-3 rounded-2xl text-xs focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100 shadow-sm"
                    />
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3.5 top-2.5 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-650 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-full text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Selector Tabs */}
                <div className="flex gap-2.5 px-5 pb-3">
                  <button
                    onClick={() => setSearchTab('sparks')}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-300 ease-spring active:scale-95 ${
                      searchTab === 'sparks'
                        ? 'bg-purple-650 text-white shadow-md shadow-purple-500/10'
                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-150 dark:border-slate-800'
                    }`}
                  >
                    ✨ Sparks
                  </button>
                  <button
                    onClick={() => setSearchTab('students')}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-300 ease-spring active:scale-95 ${
                      searchTab === 'students'
                        ? 'bg-purple-650 text-white shadow-md shadow-purple-500/10'
                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-150 dark:border-slate-800'
                    }`}
                  >
                    🎓 Students
                  </button>
                </div>

                {/* Results container */}
                <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-3">
                  {searchLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                      <span className="text-[11px] font-bold text-slate-450 uppercase animate-pulse">Searching database...</span>
                    </div>
                  ) : searchQuery ? (
                    searchResults.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-xs font-semibold italic bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl">
                        No matches found for "{searchQuery}".
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {searchTab === 'sparks' ? (
                          searchResults.map(p => (
                            <div 
                              key={p.id}
                              onClick={() => { setViewedUsername(p.author?.username); }}
                              className="bg-white dark:bg-slate-900 border border-slate-100/60 dark:border-slate-800/40 p-4 rounded-3xl text-left shadow-sm cursor-pointer hover:shadow-md transition-all duration-300 ease-spring active:scale-[0.99] flex flex-col gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[9px] text-slate-500">
                                  {p.author?.username?.slice(0, 2).toUpperCase() || 'SP'}
                                </div>
                                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                                  {p.author?.display_name || p.author?.username}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">@{p.author?.username}</span>
                              </div>
                              <h4 className="text-xs font-extrabold text-slate-950 dark:text-slate-50 leading-tight">✨ {p.title}</h4>
                              <p className="text-[11px] text-slate-550 dark:text-slate-350 line-clamp-2 leading-relaxed">{p.body}</p>
                            </div>
                          ))
                        ) : (
                          searchResults.map(u => (
                            <div 
                              key={u.id}
                              onClick={() => { setViewedUsername(u.username); }}
                              className="bg-white dark:bg-slate-900 border border-slate-100/60 dark:border-slate-800/40 p-3 rounded-3xl text-left shadow-sm cursor-pointer hover:shadow-md transition-all duration-300 ease-spring active:scale-[0.99] flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                {u.avatar_url ? (
                                  <img src={u.avatar_url} alt="avatar" className="w-9 h-9 rounded-full object-cover border border-slate-100 dark:border-slate-800" />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-550">
                                    {u.display_name?.slice(0, 2).toUpperCase() || u.username.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="flex flex-col text-left">
                                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{u.display_name || u.username}</span>
                                  <span className="text-[9px] text-slate-450">@{u.username}</span>
                                </div>
                              </div>
                              <button className="px-3 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 rounded-full text-[10px] font-black text-purple-600 dark:text-purple-400 transition-all focus:outline-none">
                                View
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  ) : (
                    /* Default state: Trending tags + Recommended Profiles */
                    <div className="flex flex-col gap-5 text-left animate-fade-in">
                      {/* Trending Tags */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest pl-0.5">
                          Trending Sparks
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {['#development', '#design', '#hackathon', '#exams', '#stbrittos', '#sports'].map(tag => (
                            <button
                              key={tag}
                              onClick={() => { setSearchTab('sparks'); setSearchQuery(tag); }}
                              className="px-3.5 py-2 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 rounded-2xl border border-slate-200/40 dark:border-slate-800/80 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-all duration-300 ease-spring active:scale-95 flex items-center gap-1.5 shadow-sm focus:outline-none"
                            >
                              <span className="text-purple-500 font-extrabold">#</span>
                              {tag.replace('#', '')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Suggested Profiles */}
                      <div className="flex flex-col gap-2.5">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest pl-0.5">
                          Suggested Students
                        </span>
                        <div className="flex flex-col gap-2.5">
                          {[
                            {
                              username: 'alex_dev',
                              display_name: 'Alex Rivera',
                              avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
                              bio: 'Frontend Engineer @ Spark.'
                            },
                            {
                              username: 'spark_team',
                              display_name: 'Spark Team',
                              avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop',
                              bio: 'Core developers.'
                            }
                          ].map(u => (
                            <div 
                              key={u.username}
                              onClick={() => setViewedUsername(u.username)}
                              className="bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/40 p-3 rounded-2xl flex items-center justify-between cursor-pointer hover:shadow-md transition-all duration-300 ease-spring active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-3">
                                <img src={u.avatar_url} alt="avatar" className="w-9 h-9 rounded-full object-cover border border-slate-100 dark:border-slate-800" />
                                <div className="flex flex-col text-left">
                                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 leading-tight">
                                    {u.display_name}
                                  </span>
                                  <span className="text-[9px] text-slate-400">@{u.username}</span>
                                </div>
                              </div>
                              <button className="px-3.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 rounded-full text-[10px] font-black text-purple-600 dark:text-purple-400 transition-all focus:outline-none">
                                View
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Universal Logout */}
                      <div className="border-t border-slate-100 dark:border-slate-850 pt-5 mt-3 flex justify-center">
                        <button
                          onClick={handleLogOut}
                          className="px-6 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl text-[11px] font-black tracking-wider uppercase flex items-center justify-center gap-2 transition-all duration-300 ease-spring active:scale-95 text-slate-650 dark:text-slate-400 focus:outline-none"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out of Account
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Sticky Tab Navigation */}
      <AppNavigation
        activeTab={activeTab}
        isAdmin={isAdmin}
        onTabChange={handleTabChange}
        viewedUsername={viewedUsername}
      />

      {/* Overlay LinkedIn-style Create Post Modal */}
      <CreatePost 
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onPostCreated={() => setFeedRefetchTrigger(prev => prev + 1)}
      />

      {/* Glassmorphic Overlays (Notifications, Activity, DMs) */}
      {activeOverlay && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-4 animate-[scaleUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)] text-left max-h-[85vh]">
            {/* Overlay Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-50 uppercase tracking-wider pl-0.5">
                {activeOverlay === 'notifications' && 'Notifications'}
                {activeOverlay === 'activity' && 'Recent Activity'}
                {activeOverlay === 'messages' && 'Direct Messages'}
              </h2>
              <button 
                onClick={() => setActiveOverlay(null)}
                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-205 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 ease-spring hover:scale-110 active:scale-90 w-8 h-8 flex items-center justify-center focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content list */}
            <div className="flex-grow overflow-y-auto flex flex-col gap-3 py-1">
              {activeOverlay === 'notifications' && (
                <div className="flex flex-col gap-3">
                  {[
                    { id: 1, text: 'Alex Rivera followed your profile.', time: '10m ago', type: 'follow' },
                    { id: 2, text: 'Spark Team approved your spark "Frontend Optimization".', time: '1h ago', type: 'approve' },
                    { id: 3, text: 'Your account was verified as a Student Leader!', time: '1d ago', type: 'system' }
                  ].map(n => (
                    <div key={n.id} className="flex gap-3 items-start border-b border-slate-50 dark:border-slate-850/30 pb-3 last:border-0 last:pb-0">
                      <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-650 dark:text-purple-400 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col gap-0.5 text-left">
                        <p className="text-[12px] text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">{n.text}</p>
                        <span className="text-[9px] text-slate-405 font-bold">{n.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeOverlay === 'activity' && (
                <div className="flex flex-col gap-3">
                  {[
                    { id: 1, name: 'Elena Rostova', user: 'travel_bug', action: 'liked your spark "Kyoto Sunset"', time: '5m ago' },
                    { id: 2, name: 'Bob Spammer', user: 'crypto_bob', action: 'liked your spark "Welcome to Spark"', time: '20m ago' },
                    { id: 3, name: 'Alex Rivera', user: 'alex_dev', action: 'liked your spark "Kyoto Sunset"', time: '1h ago' }
                  ].map(a => (
                    <div key={a.id} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-850/30 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center font-bold text-[10px] text-slate-550">
                          {a.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col text-left">
                          <p className="text-[11px] text-slate-800 dark:text-slate-200 font-bold leading-none">
                            {a.name} <span className="text-slate-400 font-normal text-[9px]">@{a.user}</span>
                          </p>
                          <span className="text-[10px] text-slate-500 mt-1">{a.action}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold">{a.time}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeOverlay === 'messages' && (
                <div className="flex flex-col gap-3 h-64">
                  {/* Chat messages */}
                  <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
                    {[
                      { id: 1, sender: 'alex_dev', text: 'Hey! Did you check out the new dark mode?', time: '9:30 AM' },
                      { id: 2, sender: 'self', text: 'Yeah, it looks super sleek! Glassmorphism overlays are awesome.', time: '9:32 AM' },
                      { id: 3, sender: 'alex_dev', text: 'Awesome! Let me know if you want to push notifications next.', time: '9:33 AM' }
                    ].map(m => (
                      <div 
                        key={m.id} 
                        className={`flex flex-col max-w-[80%] gap-1 ${
                          m.sender === 'self' ? 'self-end items-end' : 'self-start items-start'
                        }`}
                      >
                        <div className={`px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed ${
                          m.sender === 'self' 
                            ? 'bg-purple-650 text-white rounded-br-none shadow-sm' 
                            : 'bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-350 border border-slate-200/20 dark:border-slate-850/20 rounded-bl-none'
                        }`}>
                          {m.text}
                        </div>
                        <span className="text-[8px] text-slate-400 font-bold">{m.time}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Mock Chat input */}
                  <div className="flex gap-2 border-t border-slate-100 dark:border-slate-850 pt-3">
                    <input 
                      type="text" 
                      placeholder="Type a message..."
                      className="flex-grow bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3.5 py-2 rounded-2xl text-xs focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          alert('Message simulation: Sent!');
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                    <button 
                      onClick={() => alert('Message simulation: Sent!')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-[10px] font-black tracking-wider uppercase transition-all duration-300 ease-spring active:scale-95 focus:outline-none"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
