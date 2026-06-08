import { useState, useEffect } from 'react';
import { Feed } from './components/Feed';
import { AdminDashboard } from './pages/AdminDashboard';
import { Profile } from './pages/Profile';
import { Auth } from './pages/Auth';
import { CreatePost } from './components/CreatePost';
import { AppNavigation, NavTab } from './components/AppNavigation';
import { NotificationsOverlay } from './components/NotificationsOverlay';
import { MessagesOverlay } from './components/MessagesOverlay';
import { Search, Loader2, TrendingUp } from 'lucide-react';

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
  const [activeOverlay, setActiveOverlay] = useState<'notifications' | 'messages' | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);


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
          setSession({ user: { email: 'sandbox@stbrittosacademy.edu.in', id: 'mock-user-id' } });
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
        onComplete={(newProfileId) => {
          const idToUse = newProfileId || currentProfileId;
          if (idToUse) {
            localStorage.setItem(`spark-onboarded-${idToUse}`, 'true');
            setCurrentProfileId(idToUse);
          }
          setShowOnboarding(false);
          setActiveTab('home');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex relative overflow-x-hidden">
      {/* Ambient background glow blobs */}
      <div className="ambient-blob w-[280px] h-[280px] bg-purple-500/10 dark:bg-purple-600/15 top-[-40px] left-[-60px] animate-drift-slow" />
      <div className="ambient-blob w-[320px] h-[320px] bg-pink-500/10 dark:bg-pink-600/15 bottom-[20%] right-[-80px] animate-drift-reverse-slow" />

      {/* Main page layout wrapper */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-row relative z-10">

        {/* Persistent Navigation Sidebar (Left Column) */}
        <AppNavigation
          activeTab={activeTab}
          isAdmin={isAdmin}
          onTabChange={handleTabChange}
          viewedUsername={viewedUsername}
          unreadNotifCount={unreadNotifCount}
          unreadMsgCount={unreadMsgCount}
          onOpenNotifications={() => setActiveOverlay('notifications')}
          onOpenMessages={() => setActiveOverlay('messages')}
          onLogOut={handleLogOut}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Center Content Column */}
        <main className="flex-1 min-w-0 border-x border-slate-100 dark:border-slate-900/40 flex flex-col pb-20 md:pb-6">
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
                  onOpenMessages={() => setActiveOverlay('messages')}
                  currentProfileId={currentProfileId}
                  feedRefetchTrigger={feedRefetchTrigger}
                  unreadNotifCount={unreadNotifCount}
                  unreadMsgCount={unreadMsgCount}
                  onCreatePost={() => setIsCreatePostOpen(true)}
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
                    <h1 className="text-xl font-bold text-slate-900 dark:text-slate-55">
                      Explore
                    </h1>
                  </header>

                  {/* Explore content container with max-w-2xl to match Home Feed */}
                  <div className="flex-grow overflow-y-auto flex flex-col items-center pb-6">
                    <div className="w-full px-5 flex flex-col gap-4 max-w-2xl mt-4">

                      {/* Search Bar Input */}
                      <div className="relative">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={searchTab === 'sparks' ? "Search sparks by keyword..." : "Search students by name..."}
                          className="w-full bg-white dark:bg-slate-900/70 backdrop-blur-sm border border-slate-200/80 dark:border-slate-800/80 pl-10 pr-10 py-3 rounded-2xl text-xs focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100 shadow-sm font-semibold"
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

                      {/* Filter Selector Tabs */}
                      <div className="flex gap-2.5">
                        <button
                          onClick={() => setSearchTab('sparks')}
                          className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-300 ease-spring active:scale-95 ${searchTab === 'sparks'
                              ? 'bg-purple-650 text-white shadow-md shadow-purple-500/10'
                              : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-150 dark:border-slate-800'
                            }`}
                        >
                          ✨ Sparks
                        </button>
                        <button
                          onClick={() => setSearchTab('students')}
                          className={`px-4 py-1.5 rounded-full text-[11px] font-extrabold transition-all duration-300 ease-spring active:scale-95 ${searchTab === 'students'
                              ? 'bg-purple-650 text-white shadow-md shadow-purple-500/10'
                              : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-150 dark:border-slate-800'
                            }`}
                        >
                          🎓 Students
                        </button>
                      </div>

                      {/* Results container */}
                      <div className="flex flex-col gap-3">
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
                                    <h4 className="text-xs font-extrabold text-slate-955 dark:text-slate-50 leading-tight">✨ {p.title}</h4>
                                    <p className="text-[11px] text-slate-550 dark:text-slate-355 line-clamp-2 leading-relaxed">{p.body}</p>
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
                                        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-555">
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
                                    className="px-3.5 py-2 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-855 rounded-2xl border border-slate-200/40 dark:border-slate-800/80 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-all duration-300 ease-spring active:scale-95 flex items-center gap-1.5 shadow-sm focus:outline-none"
                                  >
                                    <span className="text-purple-500 font-extrabold">#</span>
                                    {tag.replace('#', '')}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Suggested Profiles */}
                            <div className="flex flex-col gap-2.5">
                              <span className="text-[10px] font-black text-slate-400 dark:text-slate-555 uppercase tracking-widest pl-0.5">
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
                                      <img src={u.avatar_url} alt="avatar" className="w-9 h-9 shrink-0 rounded-full object-cover border border-slate-100 dark:border-slate-800" />
                                      <div className="flex flex-col text-left">
                                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 leading-tight">
                                          {u.display_name}
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-semibold">@{u.username}</span>
                                      </div>
                                    </div>
                                    <button className="px-3.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 rounded-full text-[10px] font-black text-purple-600 dark:text-purple-400 transition-all focus:outline-none">
                                      View
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {/* Footer centered under content */}
          <div className="mt-8 mb-4 flex flex-col items-center justify-center gap-1.5 text-[10px] text-slate-450 dark:text-slate-500 font-semibold select-none">
            <div className="flex gap-4">
              <a href="#" className="hover:underline">Privacy</a>
              <a href="#" className="hover:underline">Terms</a>
              <a href="#" className="hover:underline">Help</a>
            </div>
            <p className="text-slate-400 dark:text-slate-600">© 2026 Spark Social. All rights reserved.</p>
          </div>
        </main>
        <aside className="hidden lg:flex flex-col gap-6 w-80 shrink-0 sticky top-0 p-6 h-screen overflow-y-auto border-l border-slate-100 dark:border-slate-800/40">

          {/* Quick Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab !== 'explore') setActiveTab('explore');
              }}
              placeholder="Search Sparks..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 pl-10 pr-4 py-2.5 rounded-2xl text-xs focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100 shadow-sm font-semibold"
            />
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 w-5 h-5 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-[9px]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Trending Sparks Card */}
          <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm backdrop-blur-sm flex flex-col gap-4 text-left">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest pl-0.5">
              Trending Sparks
            </h3>
            <div className="flex flex-col gap-3.5">
              {[
                { category: 'TECHNOLOGY • TRENDING', tag: '#QuantumComputing', count: '12.4k Sparks' },
                { category: 'DESIGN • TRENDING', tag: '#SpatialUI', count: '8.1k Sparks' },
                { category: 'DEVELOPMENT • TRENDING', tag: '#RustLang', count: '5.2k Sparks' }
              ].map(item => (
                <div key={item.tag} className="flex flex-col text-left">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{item.category}</span>
                  <button
                    onClick={() => {
                      setSearchTab('sparks');
                      setSearchQuery(item.tag);
                      setActiveTab('explore');
                    }}
                    className="font-extrabold text-[14px] text-slate-905 dark:text-slate-105 hover:underline text-left mt-0.5 focus:outline-none"
                  >
                    {item.tag}
                  </button>
                  <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">{item.count}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setActiveTab('explore')}
              className="text-left text-xs font-bold text-[#e52b86] hover:underline focus:outline-none mt-1"
            >
              Show more
            </button>
          </div>

          {/* Suggested for you Card */}
          <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm backdrop-blur-sm flex flex-col gap-4 text-left">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest pl-0.5">
              Suggested for you
            </h3>
            <div className="flex flex-col gap-3.5">
              {[
                {
                  username: 'marcus_l',
                  display_name: 'Marcus Lin',
                  role: 'AI Researcher',
                  avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
                },
                {
                  username: 'aria_t',
                  display_name: 'Aria Thorne',
                  role: 'UX Strategy',
                  avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop',
                }
              ].map(u => (
                <div
                  key={u.username}
                  className="flex items-center justify-between gap-2 text-left"
                >
                  <div
                    onClick={() => { setViewedUsername(u.username); setActiveTab('home'); }}
                    className="flex items-center gap-3 cursor-pointer hover:opacity-90"
                  >
                    <img src={u.avatar_url} alt="avatar" className="w-9 h-9 shrink-0 rounded-full object-cover border border-slate-100 dark:border-slate-800/40" />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-slate-105 leading-tight">
                        {u.display_name}
                      </span>
                      <span className="text-[10px] text-slate-400 leading-normal">{u.role}</span>
                    </div>
                  </div>
                  <button className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-950 rounded-full text-[11px] font-bold transition-all focus:outline-none select-none">
                    Follow
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setActiveTab('explore')}
              className="text-left text-xs font-bold text-[#e52b86] hover:underline focus:outline-none mt-1"
            >
              Show more
            </button>
          </div>

          {/* Engagement Stat Card */}
          <div className="bg-white/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm backdrop-blur-sm flex flex-col gap-2 text-left">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 dark:bg-pink-550/20 flex items-center justify-center mb-1">
              <TrendingUp className="w-5 h-5 text-[#e52b86]" />
            </div>
            <span className="text-2xl font-black text-slate-950 dark:text-white leading-none">4.2k</span>
            <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold leading-relaxed">
              Engagement increase on Spark this week.
            </span>
          </div>

          {/* Footer details */}
          <div className="px-2 text-[10px] text-slate-400 dark:text-slate-555 font-medium text-left leading-relaxed">
            <p>© 2026 Spark Social. All rights reserved.</p>
            <p className="mt-0.5">St. Brittos Academy social hub.</p>
          </div>
        </aside>
      </div>

      {/* Floating LinkedIn-style Create Post Modal */}
      <CreatePost
        isOpen={isCreatePostOpen}
        onClose={() => setIsCreatePostOpen(false)}
        onPostCreated={() => setFeedRefetchTrigger(prev => prev + 1)}
      />

      {/* Sliding/overlay Notifications Drawer */}
      <NotificationsOverlay
        isOpen={activeOverlay === 'notifications'}
        onClose={() => setActiveOverlay(null)}
        currentProfileId={currentProfileId}
        onUnreadCountChange={setUnreadNotifCount}
        onNavigateToProfile={(username) => { setViewedUsername(username); setActiveTab('home'); }}
      />

      {/* Sliding/overlay Messages Drawer */}
      <MessagesOverlay
        isOpen={activeOverlay === 'messages'}
        onClose={() => setActiveOverlay(null)}
        currentProfileId={currentProfileId}
        onUnreadCountChange={setUnreadMsgCount}
        onNavigateToProfile={(username) => setViewedUsername(username)}
      />
    </div>
  );
}

export default App;

