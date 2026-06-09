import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, SendHorizontal, Loader2 } from 'lucide-react';
import { toggleLike, fetchLikeStatus, toggleBookmark, fetchBookmarkStatus, fetchComments, createComment, CommentWithAuthor } from '../lib/api';
import { supabase } from '../lib/supabaseClient';

export interface PostCardProps {
  postId: string;
  avatarUrl?: string | null;
  username: string;
  displayName?: string | null;
  authorBio?: string | null;
  title: string;
  body: string;
  mediaUrls?: string[];
  timestamp: string;
  likesCount?: number;
  commentsCount?: number;
  onAvatarClick?: (username: string) => void;
  status?: 'pending' | 'approved' | 'rejected' | 'archived';
}

const formatCount = (count: number) => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace('.0', '') + 'k';
  }
  return count.toString();
};

const renderParsedBody = (text: string) => {
  if (!text.includes('```')) {
    return <p className="text-slate-700 dark:text-slate-300 text-[14px] leading-relaxed whitespace-pre-line">{text}</p>;
  }

  const parts = text.split('```');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      // Code block part. The first line might specify the language, e.g. "typescript"
      const lines = part.split('\n');
      let language = 'code';
      let code = part;
      if (lines[0] && !lines[0].includes(' ') && lines[0].length < 15) {
        language = lines[0].trim();
        code = lines.slice(1).join('\n');
      }
      return (
        <div key={index} className="my-3 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 font-mono text-[11px] text-slate-300 shadow-sm relative">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase font-bold tracking-wider text-slate-400 select-none">
            <span>{language}</span>
          </div>
          <pre className="p-4 overflow-x-auto text-left leading-relaxed">
            <code className="text-pink-400/90">{code.trim()}</code>
          </pre>
        </div>
      );
    } else {
      // Normal text part
      return part.trim() ? (
        <p key={index} className="text-slate-700 dark:text-slate-300 text-[14px] leading-relaxed whitespace-pre-line my-1.5">
          {part}
        </p>
      ) : null;
    }
  });
};

export const PostCard: React.FC<PostCardProps> = ({
  postId,
  avatarUrl,
  username,
  displayName,
  authorBio,
  title,
  body,
  mediaUrls = [],
  timestamp,
  likesCount = 42,
  commentsCount = 8,
  onAvatarClick,
  status,
}) => {
  const [isLiked, setIsLiked] = useState(false); 
  const [isSaved, setIsSaved] = useState(false); 
  const [localLikes, setLocalLikes] = useState(likesCount);
  const [localCommentsCount, setLocalCommentsCount] = useState(commentsCount);
  const [animateLike, setAnimateLike] = useState(false);
  
  // Interactive features states
  const [currentProfileId, setCurrentProfileId] = useState<string>('auth-2');
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Sync state with parent props updates
  useEffect(() => {
    setLocalLikes(likesCount);
  }, [likesCount]);

  useEffect(() => {
    setLocalCommentsCount(commentsCount);
  }, [commentsCount]);

  // Initialize and check status
  useEffect(() => {
    let active = true;
    async function initInteractions() {
      let pId = 'auth-2';
      const isSupabaseConfigured =
        import.meta.env.VITE_SUPABASE_URL &&
        import.meta.env.VITE_SUPABASE_URL !== 'your_supabase_project_url';
        
      if (isSupabaseConfigured) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && active) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', user.id)
              .single();
            if (prof) {
              pId = prof.id;
              setCurrentProfileId(pId);
            }
          }
        } catch (e) {
          console.error('Failed to load user profile in card:', e);
        }
      }

      const liked = await fetchLikeStatus(postId, pId);
      const saved = await fetchBookmarkStatus(postId, pId);
      
      if (active) {
        setIsLiked(liked);
        setIsSaved(saved);
      }
    }
    initInteractions();
    return () => { active = false; };
  }, [postId]);

  const handleLike = async () => {
    const nextLikedState = !isLiked;
    setIsLiked(nextLikedState);
    setLocalLikes(prev => nextLikedState ? prev + 1 : prev - 1);
    if (nextLikedState) {
      setAnimateLike(true);
      setTimeout(() => setAnimateLike(false), 500);
    }
    try {
      await toggleLike(postId, currentProfileId, isLiked);
    } catch (e) {
      console.error('Failed to sync like status:', e);
      setIsLiked(isLiked);
      setLocalLikes(prev => isLiked ? prev + 1 : prev - 1);
    }
  };

  const handleBookmark = async () => {
    const nextSavedState = !isSaved;
    setIsSaved(nextSavedState);
    try {
      await toggleBookmark(postId, currentProfileId, isSaved);
      setToastMsg(nextSavedState ? 'Spark saved to bookmarks!' : 'Removed from bookmarks');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (e) {
      console.error('Failed to sync bookmark:', e);
      setIsSaved(isSaved);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/spark/${postId}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setToastMsg('Link copied to clipboard!');
        setTimeout(() => setToastMsg(null), 3000);
      })
      .catch(() => {
        setToastMsg('Failed to copy share link');
        setTimeout(() => setToastMsg(null), 3000);
      });
  };

  const handleToggleComments = async () => {
    const nextShow = !showComments;
    setShowComments(nextShow);
    if (nextShow) {
      setLoadingComments(true);
      try {
        const list = await fetchComments(postId);
        setComments(list);
      } catch (e) {
        console.error('Failed to load comments:', e);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const text = commentText;
    setCommentText('');
    try {
      const newComment = await createComment(postId, currentProfileId, text);
      setComments(prev => [...prev, newComment]);
      setLocalCommentsCount(prev => prev + 1);
    } catch (e: any) {
      alert('Failed to post comment: ' + e.message);
      setCommentText(text);
    }
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const mainImageUrl = mediaUrls.length > 0 ? mediaUrls[0] : null;

  return (
    <article className="w-full bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800/60 py-4 animate-fade-in">
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 pb-3">
        <div className="flex items-center gap-3">
          {/* Avatar Container with Gradient Border (Touch Target min 44x44px via padding) */}
          <button
            onClick={() => onAvatarClick?.(username)}
            className="relative p-[1.5px] bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-600 rounded-full transition-transform active:scale-95 text-left focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={`View ${username}'s profile`}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${username}'s avatar`}
                className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-900"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-semibold text-sm border-2 border-white dark:border-slate-900 text-slate-600 dark:text-slate-300">
                {getInitials(displayName || username)}
              </div>
            )}
          </button>

          {/* User Meta */}
          <div className="flex flex-col text-left">
            <div className="flex items-center flex-wrap">
              <button
                onClick={() => onAvatarClick?.(username)}
                className="font-bold text-slate-900 dark:text-white hover:underline text-[14px] leading-none text-left"
              >
                {displayName || username}
              </button>
              <span className="text-slate-400 dark:text-slate-500 text-xs ml-1.5 font-semibold leading-none">@{username}</span>
              <span className="text-slate-400 dark:text-slate-500 text-xs ml-1.5 font-semibold leading-none">• {timestamp}</span>
              {status && status !== 'approved' && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ml-2 ${
                  status === 'pending'
                    ? 'bg-amber-100 text-amber-850 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/20'
                    : status === 'rejected'
                      ? 'bg-red-100 text-red-850 dark:bg-red-950/40 dark:text-red-400 border border-red-200/20'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-900/60 dark:text-slate-400 border border-slate-200/20'
                }`}>
                  {status === 'pending' ? 'Pending Review' : status}
                </span>
              )}
            </div>
            {authorBio && (
              <span className="text-slate-400 dark:text-slate-500 text-[11px] font-bold mt-1.5 leading-none">
                {authorBio}
              </span>
            )}
          </div>
        </div>

        {/* 44x44px touch target for menu button */}
        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors w-11 h-11 flex items-center justify-center rounded-full focus:outline-none">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Main Card Content */}
      <div className="px-5 pb-3 flex flex-col gap-1.5 text-left">
        {title && (
          <p className="font-extrabold text-[15px] text-slate-900 dark:text-slate-100 leading-snug">
            {title}
          </p>
        )}
        {body && renderParsedBody(body)}
      </div>

      {/* Image Container (with matching margin) */}
      {mainImageUrl && (
        <div 
          className="relative px-5 select-none cursor-pointer group" 
          onDoubleClick={handleLike}
        >
          <div className="relative w-full aspect-video md:aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950">
            <img
              src={mainImageUrl}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-750"
              loading="lazy"
            />
            {/* Heart Pop Animation on Double Click */}
            {animateLike && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Heart className="w-20 h-20 text-white fill-white drop-shadow-lg animate-[ping_0.5s_ease-in-out_infinite]" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact premium action row */}
      <div className="px-5 py-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-850/60 mt-3 select-none text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-6">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 hover:text-pink-600 transition-colors duration-200 focus:outline-none text-[13px] font-bold ${
              isLiked ? 'text-pink-650 dark:text-pink-400' : ''
            }`}
          >
            <Heart className={`w-[18px] h-[18px] ${isLiked ? 'fill-pink-600 text-pink-600' : ''}`} />
            <span>{formatCount(localLikes)}</span>
          </button>

          {/* Comment */}
          <button
            onClick={handleToggleComments}
            className="flex items-center gap-1.5 hover:text-purple-600 transition-colors duration-200 focus:outline-none text-[13px] font-bold"
          >
            <MessageCircle className="w-[18px] h-[18px]" />
            <span>{formatCount(localCommentsCount)}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex items-center hover:text-blue-500 transition-colors duration-200 focus:outline-none"
          >
            <Send className="w-[18px] h-[18px] rotate-[-15deg] translate-y-[-1px]" />
          </button>
        </div>

        {/* Save */}
        <button
          onClick={handleBookmark}
          className={`flex items-center hover:text-amber-500 transition-colors duration-200 focus:outline-none ${
            isSaved ? 'text-amber-500' : ''
          }`}
        >
          <Bookmark className={`w-[18px] h-[18px] ${isSaved ? 'fill-amber-500 text-amber-500' : ''}`} />
        </button>
      </div>

      {/* Toast Alert message */}
      {toastMsg && (
        <div className="mx-5 mt-3.5 px-4 py-2 bg-slate-900/90 dark:bg-slate-800/90 text-white text-[11px] font-bold rounded-2xl animate-fade-in shadow-md text-center z-20">
          ✨ {toastMsg}
        </div>
      )}

      {/* Expandable Comments Section */}
      {showComments && (
        <div className="border-t border-slate-100 dark:border-slate-800/60 mt-3.5 pt-3.5 px-5 flex flex-col gap-3.5 animate-fade-in">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-0.5 text-left">
            Comments ({comments.length})
          </span>

          {loadingComments ? (
            <div className="flex items-center gap-2 py-4 justify-center text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span>Fetching discussions...</span>
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-600 italic py-2 pl-0.5 text-left">
              No comments yet. Start the conversation!
            </p>
          ) : (
            <div className="flex flex-col gap-3.5 max-h-48 overflow-y-auto pr-1">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2.5 items-start text-left">
                  {c.author?.avatar_url ? (
                    <img 
                      src={c.author.avatar_url} 
                      alt="avatar" 
                      className="w-7 h-7 rounded-full object-cover mt-0.5 border border-slate-200/50 dark:border-slate-800" 
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-550 mt-0.5">
                      {getInitials(c.author?.display_name || c.author?.username || 'AN')}
                    </div>
                  )}
                  <div className="flex-1 bg-slate-50 dark:bg-slate-950 px-3 py-2 rounded-2xl border border-slate-200/20 dark:border-slate-850/20 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-[11px] font-black text-slate-850 dark:text-slate-100">
                        {c.author?.display_name || c.author?.username}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold">
                        @{c.author?.username}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-650 dark:text-slate-300 leading-normal break-all">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment submission form */}
          <form onSubmit={handleSubmitComment} className="flex items-center gap-2 mt-1">
            <input 
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3.5 py-2.5 rounded-2xl text-[12px] focus:outline-none focus:border-purple-500 text-slate-800 dark:text-slate-100"
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-405 dark:disabled:text-slate-600 text-white flex items-center justify-center transition-all duration-300 ease-spring active:scale-90 focus:outline-none"
              aria-label="Post comment"
            >
              <SendHorizontal className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </article>
  );
};
