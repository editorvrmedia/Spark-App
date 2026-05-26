import React from 'react';

interface SparkLogoProps {
  className?: string;
  size?: number;
}

export const SparkLogo: React.FC<SparkLogoProps> = ({ className = '', size = 32 }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 100 100" 
      fill="none" 
      width={size} 
      height={size}
      className={`inline-block select-none ${className}`}
    >
      <defs>
        {/* Harmonious vibrant gradient */}
        <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F43F5E" />
          <stop offset="40%" stopColor="#EC4899" />
          <stop offset="75%" stopColor="#D946EF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        {/* Soft neon glow filter */}
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Dashed outer orbital ring - slowly rotating */}
      <circle 
        cx="50" 
        cy="50" 
        r="42" 
        stroke="url(#sparkGrad)" 
        strokeWidth="3.5" 
        strokeDasharray="8 8" 
        className="animate-[spin_25s_linear_infinite]" 
        style={{ transformOrigin: 'center' }}
      />
      
      {/* Glowing inner lightning spark path */}
      <path 
        d="M52 14 L30 50 H48 L44 86 L70 44 H52 Z" 
        fill="url(#sparkGrad)" 
        filter="url(#glow)" 
      />
    </svg>
  );
};
