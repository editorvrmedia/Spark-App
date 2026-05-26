import { useState, useEffect } from 'react';
import { Feed } from './components/Feed';
import { AdminDashboard } from './pages/AdminDashboard';
import { Profile } from './pages/Profile';
import { Auth } from './pages/Auth';
import { CreatePost } from './components/CreatePost';
import { AppNavigation, NavTab } from './components/AppNavigation';
import { Search, LogOut } from 'lucide-react';
import { supabase } from './lib/supabaseClient';

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
      } else {
        const mockEmail = session.user?.email || '';
        const whitelistedMails = ['admin1@stbrittosacademy.edu.in', 'admin2@stbrittosacademy.edu.in'];
        setIsAdmin(whitelistedMails.includes(mockEmail.toLowerCase()));
      }
      return;
    }

    async function loadRoleAndAdminStatus() {
      try {
        // Call the is_admin() RPC to verify access
        const { data: isAdminResult, error: rpcError } = await supabase.rpc('is_admin');
        if (!rpcError && isAdminResult !== undefined) {
          setIsAdmin(!!isAdminResult);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Failed to load session profile role or admin status:', err);
        setIsAdmin(false);
      }
    }

    loadRoleAndAdminStatus();
  }, [session, isSupabaseConfigured]);

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
        onAuthSuccess={(sess) => setSession(sess)} 
        onBypass={() => setSession({ user: { email: 'sandbox@stbrittosacademy.edu.in' } })}
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

                <div className="flex-grow flex flex-col items-center justify-center text-center p-8 py-24 text-slate-400 gap-3">
                  <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-full border border-dashed border-slate-200 dark:border-slate-800">
                    <Search className="w-10 h-10 text-purple-500 animate-pulse" />
                  </div>
                  <h2 className="text-base font-bold text-slate-700 dark:text-slate-300">
                    Search & Explore
                  </h2>
                  <p className="text-xs max-w-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Explore new communities, trending posts, and sparks matching your interest.
                  </p>
                  <button
                    onClick={handleLogOut}
                    className="mt-6 px-6 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-300 ease-spring active:scale-95 text-slate-600 dark:text-slate-400"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
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
      />
    </div>
  );
}

export default App;
