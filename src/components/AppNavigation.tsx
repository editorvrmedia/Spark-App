import React from 'react';
import { Home, User, Search, ShieldAlert, Bell, MessageSquare, LogOut, Sun, Moon, Zap } from 'lucide-react';

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
      <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 border-r border-slate-100 dark:border-slate-900/40 bg-white/70 dark:bg-[#0E0E11] px-4 py-6 justify-between select-none z-40">
        <div className="flex flex-col gap-8">
          {/* Logo Section */}
          <div
            onClick={() => onTabChange('home')}
            className="flex items-center gap-3 px-3 cursor-pointer select-none active:scale-[0.98] transition-transform"
          >
            <Zap className="w-8 h-8 text-[#e52b86] fill-[#e52b86] animate-pulse" />
            <span className="text-3xl font-black text-[#e52b86] tracking-tighter font-sans">
              Spark
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {/* Home */}
            <button
              onClick={() => onTabChange('home')}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] font-extrabold transition-all duration-200 active:scale-98 focus:outline-none text-left ${activeTab === 'home' && !viewedUsername
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900'
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
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900'
                  : 'text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
              <Search className="w-5.5 h-5.5" strokeWidth={2} />
              <span>Explore</span>
            </button>

            {/* Notifications */}
            <button
              onClick={onOpenNotifications}
              className="flex items-center justify-between w-full px-4 py-3 rounded-2xl text-[14px] font-extrabold transition-all duration-200 active:scale-98 focus:outline-none text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200"
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
              className="flex items-center justify-between w-full px-4 py-3 rounded-2xl text-[14px] font-extrabold transition-all duration-200 active:scale-98 focus:outline-none text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200"
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
              className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] font-extrabold transition-all duration-200 active:scale-98 focus:outline-none text-left ${activeTab === 'profile' || (viewedUsername && (viewedUsername === 'alex_dev' || viewedUsername === 'j_vane'))
                  ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900'
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
                    ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900'
                    : 'text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
              >
                <ShieldAlert className="w-5.5 h-5.5 text-[#e52b86]" strokeWidth={2} />
                <span>Moderator Guard</span>
              </button>
            )}
          </nav>

          {/* Create Post Action */}
          <button
            onClick={() => onTabChange('create')}
            className="w-full py-3 rounded-2xl text-sm font-bold bg-[#e52b86] hover:bg-[#d02478] text-white shadow-lg shadow-pink-500/10 hover:shadow-pink-500/20 transition-all duration-200 active:scale-[0.97] focus:outline-none flex items-center justify-center"
          >
            <span className="text-lg font-bold mr-1.5 leading-none">+</span>
            <span>Post Spark</span>
          </button>
        </div>

        {/* Footer Actions (Theme + LogOut) */}
        <div className="flex flex-col gap-3">
          {/* Light/Dark Toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors focus:outline-none text-left"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-5.5 h-5.5 text-amber-500" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-5.5 h-5.5 text-indigo-650" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          )}

          {/* Logout */}
          {onLogOut && (
            <button
              onClick={onLogOut}
              className="flex items-center gap-3.5 px-4 py-2.5 rounded-2xl text-[13px] font-bold text-slate-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all focus:outline-none text-left"
            >
              <LogOut className="w-5.5 h-5.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#0E0E11]/90 backdrop-blur-lg border-t border-slate-200/60 dark:border-slate-850/60 px-2 justify-around items-center select-none z-40 shadow-lg pb-[safe-area-inset-bottom]">
        {/* Home */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all relative ${
            activeTab === 'home' && !viewedUsername
              ? 'text-[#e52b86]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          aria-label="Home"
        >
          <Home className="w-5 h-5" />
          <span className="text-[9px] font-extrabold mt-0.5">Home</span>
        </button>

        {/* Explore */}
        <button
          onClick={() => onTabChange('explore')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all relative ${
            activeTab === 'explore'
              ? 'text-[#e52b86]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          aria-label="Explore"
        >
          <Search className="w-5 h-5" />
          <span className="text-[9px] font-extrabold mt-0.5">Explore</span>
        </button>

        {/* Create Spark (Action FAB) */}
        <button
          onClick={() => onTabChange('create')}
          className="flex flex-col items-center justify-center -mt-6 bg-[#e52b86] hover:bg-[#d02478] text-white w-12 h-12 rounded-full shadow-lg shadow-pink-500/30 transition-transform active:scale-95 z-50 focus:outline-none border-4 border-slate-50 dark:border-slate-950"
          aria-label="Create Spark"
        >
          <span className="text-2xl font-bold leading-none select-none">+</span>
        </button>

        {/* Messages */}
        <button
          onClick={onOpenMessages}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all relative text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          aria-label="Messages"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {unreadMsgCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 bg-blue-500 text-white text-[8px] font-black rounded-full leading-none flex items-center justify-center">
                {unreadMsgCount}
              </span>
            )}
          </div>
          <span className="text-[9px] font-extrabold mt-0.5">Messages</span>
        </button>

        {/* Alerts (Notifications) */}
        <button
          onClick={onOpenNotifications}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all relative text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          aria-label="Notifications"
        >
          <div className="relative">
            <Bell className="w-5 h-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full leading-none flex items-center justify-center">
                {unreadNotifCount}
              </span>
            )}
          </div>
          <span className="text-[9px] font-extrabold mt-0.5">Alerts</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all relative ${
            activeTab === 'profile'
              ? 'text-[#e52b86]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          aria-label="Profile"
        >
          <User className="w-5 h-5" />
          <span className="text-[9px] font-extrabold mt-0.5">Profile</span>
        </button>
      </nav>
    </>
  );
};
