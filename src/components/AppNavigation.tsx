import React from 'react';
import { Home, User, Search, ShieldAlert, PlusSquare, Bell, MessageSquare, LogOut, Sun, Moon } from 'lucide-react';
import { SparkLogo } from './SparkLogo';

export type NavTab = 'home' | 'explore' | 'create' | 'profile' | 'admin';

interface AppNavigationProps {
  activeTab: NavTab;
  isAdmin: boolean;
  onTabChange: (tab: NavTab) => void;
  viewedUsername: string | null;
  unreadNotifCount?: number;
  unreadMsgCount?: number;
  onOpenNotifications?: () => void;
  onOpenMessages?: () => void;
  onLogOut?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const AppNavigation: React.FC<AppNavigationProps> = ({
  activeTab,
  isAdmin,
  onTabChange,
  viewedUsername,
  unreadNotifCount = 0,
  unreadMsgCount = 0,
  onOpenNotifications,
  onOpenMessages,
  onLogOut,
  theme = 'light',
  onToggleTheme,
}) => {
  return (
    <>
      {/* PERSISTENT SIDEBAR NAVIGATION */}
      <aside className="flex flex-col w-64 h-screen sticky top-0 border-r border-slate-100 dark:border-slate-900/50 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md px-4 py-6 justify-between select-none z-40">
        <div className="flex flex-col gap-8">
          {/* Logo Section */}
          <div
            onClick={() => onTabChange('home')}
            className="flex items-center gap-3 px-3 cursor-pointer select-none active:scale-[0.98] transition-transform"
          >
            <SparkLogo size={36} className="relative top-[-1px]" />
            <span className="text-3xl font-black text-[#D946EF] dark:text-[#E879F9] tracking-tighter font-sans bg-gradient-to-r from-pink-500 to-fuchsia-600 bg-clip-text text-transparent">
              Spark
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {/* Home */}
            <button
              onClick={() => onTabChange('home')}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] font-extrabold transition-all duration-200 active:scale-98 focus:outline-none text-left ${activeTab === 'home' && !viewedUsername
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/15'
                  : 'text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
              <Home className="w-5.5 h-5.5" strokeWidth={2} />
              <span>Home</span>
            </button>

            {/* Explore */}
            <button
              onClick={() => onTabChange('explore')}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] font-extrabold transition-all duration-200 active:scale-98 focus:outline-none text-left ${activeTab === 'explore'
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/15'
                  : 'text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
              <Search className="w-5.5 h-5.5" strokeWidth={2} />
              <span>Explore</span>
            </button>

            {/* Notifications */}
            <button
              onClick={onOpenNotifications}
              className="flex items-center justify-between w-full px-4 py-3 rounded-2xl text-[14px] font-extrabold transition-all duration-200 active:scale-98 focus:outline-none text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <div className="flex items-center gap-3.5">
                <Bell className="w-5.5 h-5.5" strokeWidth={2} />
                <span>Notifications</span>
              </div>
              {unreadNotifCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {/* Messages */}
            <button
              onClick={onOpenMessages}
              className="flex items-center justify-between w-full px-4 py-3 rounded-2xl text-[14px] font-extrabold transition-all duration-200 active:scale-98 focus:outline-none text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <div className="flex items-center gap-3.5">
                <MessageSquare className="w-5.5 h-5.5" strokeWidth={2} />
                <span>Messages</span>
              </div>
              {unreadMsgCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-black rounded-full shadow-sm">
                  {unreadMsgCount}
                </span>
              )}
            </button>

            {/* Profile */}
            <button
              onClick={() => onTabChange('profile')}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] font-extrabold transition-all duration-200 active:scale-98 focus:outline-none text-left ${activeTab === 'profile' || (viewedUsername && viewedUsername === 'alex_dev')
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/15'
                  : 'text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
              <User className="w-5.5 h-5.5" strokeWidth={2} />
              <span>Profile</span>
            </button>

            {/* Moderator Dashboard */}
            {isAdmin && (
              <button
                onClick={() => onTabChange('admin')}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] font-extrabold transition-all duration-200 active:scale-98 focus:outline-none text-left ${activeTab === 'admin'
                    ? 'text-purple-650 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/15'
                    : 'text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
              >
                <ShieldAlert className="w-5.5 h-5.5 text-purple-500" strokeWidth={2} />
                <span>Moderator Guard</span>
              </button>
            )}
          </nav>

          {/* Create Post Action */}
          <button
            onClick={() => onTabChange('create')}
            className="w-full py-3.5 rounded-2xl text-sm font-black bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 active:scale-[0.97] focus:outline-none flex items-center justify-center gap-2"
          >
            <PlusSquare className="w-5 h-5" strokeWidth={2.25} />
            <span>Create Spark</span>
          </button>
        </div>

        {/* Footer Actions (Theme + LogOut) */}
        <div className="flex flex-col gap-3">
          {/* Light/Dark Toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-slate-550 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors focus:outline-none text-left"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-5.5 h-5.5 text-amber-500" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-5.5 h-5.5 text-indigo-600" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          )}

          {/* Logout */}
          {onLogOut && (
            <button
              onClick={onLogOut}
              className="flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all focus:outline-none text-left"
            >
              <LogOut className="w-5.5 h-5.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
