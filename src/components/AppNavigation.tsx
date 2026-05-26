import React from 'react';
import { Home, User, Search, ShieldAlert, PlusSquare } from 'lucide-react';

export type NavTab = 'home' | 'explore' | 'create' | 'profile' | 'admin';

const AdminLink: React.FC<{ activeTab: NavTab; onClick: () => void }> = ({ activeTab, onClick }) => (
  <button
    onClick={onClick}
    className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ease-spring hover:scale-110 active:scale-90 focus:outline-none ${
      activeTab === 'admin' 
        ? 'text-purple-600 dark:text-purple-400 bg-purple-50/40 dark:bg-purple-950/10' 
        : 'text-slate-800 dark:text-slate-400 hover:text-slate-600'
    }`}
    aria-label="Admin Dashboard"
  >
    <ShieldAlert className="w-7 h-7" strokeWidth={1.75} />
  </button>
);

interface AppNavigationProps {
  activeTab: NavTab;
  isAdmin: boolean;
  onTabChange: (tab: NavTab) => void;
  viewedUsername: string | null;
}

export const AppNavigation: React.FC<AppNavigationProps> = ({
  activeTab,
  isAdmin,
  onTabChange,
  viewedUsername,
}) => {
  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 glass-nav flex items-center justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.03)]"
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', paddingTop: '10px' }}
    >
      <div className="w-full max-w-md flex items-center justify-around px-6">
        {/* Home Button (w-12 h-12) */}
        <button
          onClick={() => onTabChange('home')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ease-spring hover:scale-110 active:scale-90 focus:outline-none ${
            activeTab === 'home' && !viewedUsername
              ? 'text-purple-600 dark:text-purple-400 bg-purple-50/40 dark:bg-purple-950/10' 
              : 'text-slate-800 dark:text-slate-400 hover:text-slate-600'
          }`}
          aria-label="Home Feed"
        >
          <Home className="w-7 h-7" strokeWidth={1.75} />
        </button>

        {/* Search Button (w-12 h-12) */}
        <button
          onClick={() => onTabChange('explore')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ease-spring hover:scale-110 active:scale-90 focus:outline-none ${
            activeTab === 'explore' 
              ? 'text-purple-600 dark:text-purple-400 bg-purple-50/40 dark:bg-purple-950/10' 
              : 'text-slate-800 dark:text-slate-400 hover:text-slate-600'
          }`}
          aria-label="Search and Explore"
        >
          <Search className="w-7 h-7" strokeWidth={1.75} />
        </button>

        {/* Create Post Button (w-12 h-12) */}
        <button
          onClick={() => onTabChange('create')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ease-spring hover:scale-110 active:scale-90 focus:outline-none ${
            activeTab === 'create' 
              ? 'text-purple-600 dark:text-purple-400 bg-purple-50/40 dark:bg-purple-950/10' 
              : 'text-slate-800 dark:text-slate-400 hover:text-slate-600'
          }`}
          aria-label="Create Post"
        >
          <PlusSquare className="w-7 h-7" strokeWidth={1.75} />
        </button>

        {/* Admin Dashboard Button - Rendered ONLY if user is whitelisted admin */}
        {isAdmin && (
          <AdminLink activeTab={activeTab} onClick={() => onTabChange('admin')} />
        )}

        {/* Profile Button (w-12 h-12) */}
        <button
          onClick={() => onTabChange('profile')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ease-spring hover:scale-110 active:scale-90 focus:outline-none ${
            activeTab === 'profile' || (viewedUsername && viewedUsername === 'alex_dev')
              ? 'text-purple-600 dark:text-purple-400 bg-purple-50/40 dark:bg-purple-950/10' 
              : 'text-slate-800 dark:text-slate-400 hover:text-slate-600'
          }`}
          aria-label="Profile"
        >
          <User className="w-7 h-7" strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  );
};
