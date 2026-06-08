import { useState, useEffect } from 'react';

import { X, Bell, CheckCheck, Loader2, Heart, MessageCircle, UserPlus, CheckCircle, XCircle } from 'lucide-react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  AppNotification
} from '../lib/api';

interface NotificationsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfileId: string | null;
  onUnreadCountChange?: (count: number) => void;
  onNavigateToPost?: (postId: string) => void;
  onNavigateToProfile?: (username: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function groupByDate(notifications: AppNotification[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: AppNotification[] }[] = [];
  const todayItems: AppNotification[] = [];
  const yesterdayItems: AppNotification[] = [];
  const earlierItems: AppNotification[] = [];

  notifications.forEach(n => {
    const d = new Date(n.created_at);
    if (d.toDateString() === today.toDateString()) todayItems.push(n);
    else if (d.toDateString() === yesterday.toDateString()) yesterdayItems.push(n);
    else earlierItems.push(n);
  });

  if (todayItems.length > 0) groups.push({ label: 'Today', items: todayItems });
  if (yesterdayItems.length > 0) groups.push({ label: 'Yesterday', items: yesterdayItems });
  if (earlierItems.length > 0) groups.push({ label: 'Earlier', items: earlierItems });
  return groups;
}

function getNotifIcon(type: AppNotification['type']) {
  switch (type) {
    case 'like':          return <Heart className="w-3.5 h-3.5 text-pink-500" />;
    case 'comment':       return <MessageCircle className="w-3.5 h-3.5 text-blue-500" />;
    case 'follow':        return <UserPlus className="w-3.5 h-3.5 text-purple-500" />;
    case 'post_approved': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
    case 'post_rejected': return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  }
}

function getNotifBg(type: AppNotification['type']) {
  switch (type) {
    case 'like':          return 'bg-pink-50 dark:bg-pink-950/30';
    case 'comment':       return 'bg-blue-50 dark:bg-blue-950/30';
    case 'follow':        return 'bg-purple-50 dark:bg-purple-950/30';
    case 'post_approved': return 'bg-emerald-50 dark:bg-emerald-950/30';
    case 'post_rejected': return 'bg-red-50 dark:bg-red-950/30';
  }
}

export function NotificationsOverlay({
  isOpen,
  onClose,
  currentProfileId,
  onUnreadCountChange,
  onNavigateToPost,
  onNavigateToProfile
}: NotificationsOverlayProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Notify parent of unread count changes
  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  // Fetch notifications when opened
  useEffect(() => {
    if (!isOpen || !currentProfileId) return;
    setLoading(true);
    fetchNotifications(currentProfileId)
      .then(setNotifications)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen, currentProfileId]);

  // Subscribe to real-time new notifications
  useEffect(() => {
    if (!currentProfileId) return;
    const unsub = subscribeToNotifications(currentProfileId, (notif) => {
      setNotifications(prev => [notif, ...prev]);
    });
    return unsub;
  }, [currentProfileId]);

  const handleMarkAll = async () => {
    if (!currentProfileId) return;
    setMarkingAll(true);
    await markAllNotificationsRead(currentProfileId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setMarkingAll(false);
  };

  const handleNotifClick = async (notif: AppNotification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    }
    if (notif.post_id && onNavigateToPost) {
      onClose();
      onNavigateToPost(notif.post_id);
    } else if (notif.actor?.username && onNavigateToProfile) {
      onClose();
      onNavigateToProfile(notif.actor.username);
    }
  };

  if (!isOpen) return null;

  const groups = groupByDate(notifications);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-stretch justify-end p-0 bg-slate-950/60 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 w-[420px] max-w-full rounded-none overflow-hidden shadow-2xl border-l border-slate-100 dark:border-slate-800/40 flex flex-col h-screen animate-slide-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
              <Bell className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-50">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-all active:scale-95 focus:outline-none"
              >
                {markingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all active:scale-90"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-purple-500" />
              <span className="text-[11px] font-bold uppercase tracking-widest animate-pulse">Loading…</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Bell className="w-6 h-6 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-xs font-semibold text-slate-400">No notifications yet</p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600">Interact with sparks to get started</p>
            </div>
          ) : (
            <div className="px-3 py-3 flex flex-col gap-4">
              {groups.map(group => (
                <div key={group.label} className="flex flex-col gap-1">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 pt-1 pb-0.5">
                    {group.label}
                  </span>
                  <div className="flex flex-col gap-1">
                    {group.items.map(notif => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`flex items-start gap-3 w-full text-left px-3 py-3 rounded-2xl transition-all duration-200 active:scale-[0.99] focus:outline-none ${
                          notif.read
                            ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            : 'bg-purple-50/70 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/30'
                        }`}
                      >
                        {/* Actor avatar or system icon */}
                        <div className="relative flex-shrink-0 mt-0.5">
                          {notif.actor?.avatar_url ? (
                            <img
                              src={notif.actor.avatar_url}
                              alt={notif.actor.username}
                              className="w-9 h-9 rounded-full object-cover border border-slate-100 dark:border-slate-800"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              {getNotifIcon(notif.type)}
                            </div>
                          )}
                          {/* Type icon badge */}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center ${getNotifBg(notif.type)} border border-white dark:border-slate-900`}>
                            {getNotifIcon(notif.type)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] leading-relaxed ${notif.read ? 'text-slate-600 dark:text-slate-400 font-medium' : 'text-slate-800 dark:text-slate-200 font-semibold'}`}>
                            {notif.message}
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium">{timeAgo(notif.created_at)}</span>
                        </div>

                        {/* Unread dot */}
                        {!notif.read && (
                          <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
