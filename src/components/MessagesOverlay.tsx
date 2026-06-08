import { useState, useEffect, useRef } from 'react';
import { X, MessageCircle, Send, ArrowLeft, Loader2 } from 'lucide-react';

import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markMessagesRead,
  subscribeToMessages,
  Conversation,
  DirectMessage
} from '../lib/api';

interface MessagesOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfileId: string | null;
  onUnreadCountChange?: (count: number) => void;
  onNavigateToProfile?: (username: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessagesOverlay({
  isOpen,
  onClose,
  currentProfileId,
  onUnreadCountChange,
  onNavigateToProfile
}: MessagesOverlayProps) {
  const [view, setView] = useState<'inbox' | 'thread'>('inbox');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  useEffect(() => {
    onUnreadCountChange?.(totalUnread);
  }, [totalUnread, onUnreadCountChange]);

  // Load inbox when opened
  useEffect(() => {
    if (!isOpen || !currentProfileId) return;
    setLoadingInbox(true);
    fetchConversations(currentProfileId)
      .then(setConversations)
      .catch(console.error)
      .finally(() => setLoadingInbox(false));
  }, [isOpen, currentProfileId]);

  // Subscribe to incoming messages
  useEffect(() => {
    if (!currentProfileId) return;
    const unsub = subscribeToMessages(currentProfileId, (msg) => {
      // Add to current thread if open
      if (activeConversation && msg.sender_id === activeConversation.other_profile_id) {
        setMessages(prev => [...prev, msg]);
        // Mark read immediately since thread is open
        markMessagesRead(currentProfileId, msg.sender_id).catch(console.error);
      } else {
        // Update conversation unread count
        setConversations(prev => prev.map(c =>
          c.other_profile_id === msg.sender_id
            ? { ...c, last_message: msg.body, last_message_at: msg.created_at, unread_count: c.unread_count + 1 }
            : c
        ));
      }
    });
    return unsub;
  }, [currentProfileId, activeConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (view === 'thread') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, view]);

  const openThread = async (conv: Conversation) => {
    if (!currentProfileId) return;
    setActiveConversation(conv);
    setView('thread');
    setLoadingThread(true);
    try {
      const msgs = await fetchMessages(currentProfileId, conv.other_profile_id);
      setMessages(msgs);
      // Mark as read
      await markMessagesRead(currentProfileId, conv.other_profile_id);
      setConversations(prev => prev.map(c =>
        c.other_profile_id === conv.other_profile_id ? { ...c, unread_count: 0 } : c
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !currentProfileId || !activeConversation || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      const newMsg = await sendMessage(currentProfileId, activeConversation.other_profile_id, text);
      setMessages(prev => [...prev, newMsg]);
      setConversations(prev => prev.map(c =>
        c.other_profile_id === activeConversation.other_profile_id
          ? { ...c, last_message: newMsg.body, last_message_at: newMsg.created_at }
          : c
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const goBack = () => {
    setView('inbox');
    setActiveConversation(null);
    setMessages([]);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-stretch justify-end p-0 bg-slate-950/60 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 w-[420px] max-w-full rounded-none overflow-hidden shadow-2xl border-l border-slate-100 dark:border-slate-800/40 flex flex-col h-screen animate-slide-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {view === 'thread' && (
              <button
                onClick={goBack}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all active:scale-90 mr-0.5"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
              {view === 'thread' && activeConversation?.other_avatar_url ? (
                <img src={activeConversation.other_avatar_url} alt="" className="w-8 h-8 rounded-xl object-cover" />
              ) : (
                <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-50">
                {view === 'thread' && activeConversation
                  ? (activeConversation.other_display_name || activeConversation.other_username)
                  : 'Messages'
                }
              </h2>
              {view === 'thread' && activeConversation && (
                <button
                  onClick={() => { onNavigateToProfile?.(activeConversation.other_username); onClose(); }}
                  className="text-[10px] text-blue-500 font-semibold hover:underline"
                >
                  @{activeConversation.other_username}
                </button>
              )}
              {view === 'inbox' && totalUnread > 0 && (
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">{totalUnread} unread</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all active:scale-90"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Inbox View */}
        {view === 'inbox' && (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {loadingInbox ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                <span className="text-[11px] font-bold uppercase tracking-widest animate-pulse">Loading…</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-xs font-semibold text-slate-400">No messages yet</p>
                <p className="text-[10px] text-slate-300 dark:text-slate-600">Visit a profile to start a conversation</p>
              </div>
            ) : (
              <div className="px-3 py-3 flex flex-col gap-1">
                {conversations.map(conv => (
                  <button
                    key={conv.other_profile_id}
                    onClick={() => openThread(conv)}
                    className={`flex items-center gap-3 w-full text-left px-3 py-3 rounded-2xl transition-all duration-200 active:scale-[0.99] focus:outline-none ${
                      conv.unread_count > 0
                        ? 'bg-blue-50/70 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {conv.other_avatar_url ? (
                        <img
                          src={conv.other_avatar_url}
                          alt={conv.other_username}
                          className="w-11 h-11 rounded-full object-cover border border-slate-100 dark:border-slate-800"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-sm text-slate-500">
                          {(conv.other_display_name || conv.other_username).slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {conv.unread_count > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-black border border-white dark:border-slate-900">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[12px] truncate ${conv.unread_count > 0 ? 'font-extrabold text-slate-900 dark:text-slate-50' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                          {conv.other_display_name || conv.other_username}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium flex-shrink-0">{timeAgo(conv.last_message_at)}</span>
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${conv.unread_count > 0 ? 'text-slate-700 dark:text-slate-300 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
                        {conv.last_message}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Thread View */}
        {view === 'thread' && (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              {loadingThread ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {messages.map((msg, idx) => {
                    const isSelf = msg.sender_id === currentProfileId;
                    const showTime = idx === messages.length - 1 ||
                      new Date(messages[idx + 1]?.created_at).getTime() - new Date(msg.created_at).getTime() > 60000 * 5;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-[12.5px] leading-relaxed shadow-sm ${
                          isSelf
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-br-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm border border-slate-200/40 dark:border-slate-700/40'
                        }`}>
                          {msg.body}
                        </div>
                        {showTime && (
                          <span className="text-[9px] text-slate-400 font-medium mt-0.5 px-1">{formatTime(msg.created_at)}</span>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message..."
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-2xl text-[12px] focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-colors"
                disabled={sending}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl transition-all duration-200 active:scale-90 focus:outline-none shadow-md shadow-blue-500/20"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
