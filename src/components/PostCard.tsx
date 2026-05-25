import React, { useState } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';

export interface PostCardProps {
  avatarUrl?: string | null;
  username: string;
  displayName?: string | null;
  title: string;
  body: string;
  mediaUrls?: string[];
  timestamp: string;
  likesCount?: number;
  commentsCount?: number;
  onAvatarClick?: (username: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  avatarUrl,
  username,
  displayName,
  title,
  body,
  mediaUrls = [],
  timestamp,
  likesCount = 42,
  commentsCount = 8,
  onAvatarClick,
}) => {
  const [isLiked, setIsLiked] = useState(true); // default liked in screenshot design
  const [isSaved, setIsSaved] = useState(true); // default saved in screenshot design
  const [localLikes, setLocalLikes] = useState(likesCount);
  const [animateLike, setAnimateLike] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLocalLikes(prev => isLiked ? prev - 1 : prev + 1);
    if (!isLiked) {
      setAnimateLike(true);
      setTimeout(() => setAnimateLike(false), 500);
    }
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const mainImageUrl = mediaUrls.length > 0 ? mediaUrls[0] : null;

  return (
    <article className="w-full bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800/40 py-4 animate-fade-in">
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
            <button
              onClick={() => onAvatarClick?.(username)}
              className="font-bold text-slate-900 dark:text-slate-50 text-[15px] hover:underline focus:outline-none text-left"
            >
              {displayName || username}
            </button>
            <span className="text-[12px] text-slate-400 dark:text-slate-500">
              @{username} • {timestamp}
            </span>
          </div>
        </div>

        {/* 44x44px touch target for menu button */}
        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors w-11 h-11 flex items-center justify-center rounded-full focus:outline-none">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Main Card Content */}
      <div className="px-5 pb-3 flex flex-col gap-1.5 text-left">
        <h3 className="font-bold text-slate-900 dark:text-slate-50 text-[15px] flex items-center gap-1.5 leading-snug">
          {title.startsWith('✨') ? title : `✨ ${title}`}
        </h3>
        <p className="text-slate-700 dark:text-slate-300 text-[14px] leading-relaxed">
          {body}
        </p>
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

      {/* Interaction Bar - All touch targets mapped to at least 44x44px */}
      <div className="px-3 pt-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* Like Button (44x44px) */}
            <button
              onClick={handleLike}
              className="w-11 h-11 flex items-center justify-center transition-transform duration-200 active:scale-125 focus:outline-none"
              aria-label="Like post"
            >
              <Heart
                className={`w-[26px] h-[26px] transition-colors duration-200 ${
                  isLiked 
                    ? 'fill-[#F43F5E] stroke-[#F43F5E]' 
                    : 'text-slate-800 dark:text-slate-200 hover:text-red-500'
                }`}
                strokeWidth={1.5}
              />
            </button>

            {/* Comment Button (44x44px) */}
            <button 
              className="w-11 h-11 flex items-center justify-center text-slate-800 dark:text-slate-200 hover:text-purple-600 transition-colors focus:outline-none"
              aria-label="Comment on post"
            >
              <MessageCircle className="w-[26px] h-[26px]" strokeWidth={1.5} />
            </button>

            {/* Share Button (44x44px) */}
            <button 
              className="w-11 h-11 flex items-center justify-center text-slate-800 dark:text-slate-200 hover:text-indigo-600 transition-colors focus:outline-none"
              aria-label="Share post"
            >
              <Send className="w-[26px] h-[26px] rotate-[-15deg] translate-y-[-1px]" strokeWidth={1.5} />
            </button>
          </div>

          {/* Bookmark Button (44x44px) */}
          <button
            onClick={() => setIsSaved(!isSaved)}
            className="w-11 h-11 flex items-center justify-center transition-transform duration-200 active:scale-125 focus:outline-none"
            aria-label="Save post"
          >
            <Bookmark 
              className={`w-[26px] h-[26px] transition-colors duration-200 ${
                isSaved 
                  ? 'fill-slate-900 stroke-slate-900 dark:fill-slate-100 dark:stroke-slate-100' 
                  : 'text-slate-800 dark:text-slate-200 hover:text-amber-500'
              }`}
              strokeWidth={1.5}
            />
          </button>
        </div>

        {/* Action Totals */}
        <div className="px-2 flex items-center gap-1.5 text-[14px] font-bold text-slate-800 dark:text-slate-200 mt-0.5 text-left">
          <span>{localLikes} likes</span>
          <span>•</span>
          <span>{commentsCount} comments</span>
        </div>
      </div>
    </article>
  );
};
