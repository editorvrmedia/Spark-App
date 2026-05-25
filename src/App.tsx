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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center">
      {/* Centered Scrollable Main Content */}
      <main className="flex-1 w-full max-w-md flex flex-col pb-24">
        {viewedUsername ? (
          <Profile username={viewedUsername} onBack={() => setViewedUsername(null)} />
        ) : (
          <>
            {activeTab === 'home' && (
              <Feed 
                onNavigateToAdmin={isAdmin ? () => handleTabChange('admin') : undefined} 
                onSelectUser={(username) => setViewedUsername(username)}
              />
            )}
            {activeTab === 'admin' && (
              <AdminDashboard onRedirectToHome={() => handleTabChange('home')} userEmail={session?.user?.email} />
            )}
            {activeTab === 'profile' && <Profile username={null} />}
            {activeTab === 'explore' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 py-24 text-slate-400 gap-3">
                <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-full border border-dashed border-slate-200 dark:border-slate-800">
                  <Search className="w-10 h-10 text-purple-500 animate-pulse" />
                </div>
                <h2 className="text-base font-bold text-slate-700 dark:text-slate-300">
                  Search & Explore
                </h2>
                <p className="text-xs max-w-xs leading-relaxed text-slate-505">
                  Explore new communities, trending posts, and sparks matching your interest.
                </p>
                <button
                  onClick={handleLogOut}
                  className="mt-6 w-11 h-11 px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors text-slate-650 dark:text-slate-400 min-w-[150px]"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
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
