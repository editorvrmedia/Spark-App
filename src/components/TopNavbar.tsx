import React from 'react';
import { SparkLogo } from './SparkLogo';
import { Home, Search, User, ShieldAlert, Bell, MessageSquare, LogOut, Sun, Moon } from 'lucide-react';
import { NavTab } from './AppNavigation';

interface TopNavbarProps {
  activeTab: NavTab;
  isAdmin: boolean;
  onTabChange: (tab: NavTab) => void;
  unreadNotifCount: number;
  unreadMsgCount: number;
  onOpenNotifications: () => void;
  onOpenMessages: () => void;
  onLogOut: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  viewedUsername: string | null;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeTab,
  isAdmin,
  onTabChange,
  unreadNotifCount,
  unreadMsgCount,
  onOpenNotifications,
  onOpenMessages,
  onLogOut,
  theme,
  onToggleTheme,
  viewedUsername,
}) => {
  return (
    <header className="hidden md:block sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-900/50 shadow-sm">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between px-4 md:px-6 lg:px-8 py-3.5">
        {/* Left Section: Logo */}
        <div 
          onClick={() => onTabChange('home')}
          className="flex items-center gap-2.5 cursor-pointer select-none active:scale-[0.98] transition-transform"
        >
          <SparkLogo size={32} className="relative top-[-1px]" />
          <span className="text-2.5xl font-black text-[#D946EF] dark:text-[#E879F9] tracking-tighter font-sans bg-gradient-to-r from-pink-500 to-fuchsia-600 bg-clip-text text-transparent">
            Spark
          </span>
        </div>

        {/* Center Section: Navigation Links */}
        <nav className="flex items-center gap-2">
          {/* Home */}
          <button
            onClick={() => onTabChange('home')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-95 focus:outline-none ${
              activeTab === 'home' && !viewedUsername
                ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/15'
                : 'text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-950 dark:hover:text-slate-50'
            }`}
          >
            <Home className="w-4.5 h-4.5" />
            <span>Home</span>
          </button>

          {/* Explore */}
          <button
            onClick={() => onTabChange('explore')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-95 focus:outline-none ${
              activeTab === 'explore'
                ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/15'
                : 'text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-950 dark:hover:text-slate-50'
            }`}
          >
            <Search className="w-4.5 h-4.5" />
            <span>Explore</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => onTabChange('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-95 focus:outline-none ${
              activeTab === 'profile' || (viewedUsername && viewedUsername === 'alex_dev')
                ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/15'
                : 'text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-950 dark:hover:text-slate-50'
            }`}
          >
            <User className="w-4.5 h-4.5" />
            <span>Profile</span>
          </button>

          {/* Moderator Dashboard */}
          {isAdmin && (
            <button
              onClick={() => onTabChange('admin')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-95 focus:outline-none ${
                activeTab === 'admin'
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/15'
                  : 'text-slate-650 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-950 dark:hover:text-slate-50'
              }`}
            >
              <ShieldAlert className="w-4.5 h-4.5 text-purple-500" />
              <span>Moderator Queue</span>
            </button>
          )}
        </nav>

        {/* Right Section: Action Buttons */}
        <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300">
          {/* Notifications button */}
          <button 
            onClick={onOpenNotifications}
            className="relative p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-all duration-200 active:scale-90 focus:outline-none" 
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-sm">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {/* Messages button */}
          <button 
            onClick={onOpenMessages}
            className="relative p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-all duration-200 active:scale-90 focus:outline-none" 
            aria-label="Direct Messages"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadMsgCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-sm">
                {unreadMsgCount}
              </span>
            )}
          </button>

          {/* Theme switcher */}
          <button
            onClick={onToggleTheme}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-all duration-200 active:scale-90 focus:outline-none"
            aria-label="Toggle Theme"
            title="Toggle Dark/Light Mode"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-600" />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogOut}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 hover:border-red-200 hover:bg-red-50 dark:border-slate-800 dark:hover:border-red-900/30 dark:hover:bg-red-950/20 rounded-xl text-xs font-bold transition-all text-slate-500 hover:text-red-650 dark:hover:text-red-400 focus:outline-none"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
