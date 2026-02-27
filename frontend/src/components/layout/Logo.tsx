import React from 'react';

const Logo = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative w-10 h-10 flex items-center justify-center bg-primary rounded-xl overflow-hidden shadow-lg shadow-primary/20">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6 text-white"
        >
          <path d="M22 10.5C22 7.5 19.5 5 16.5 5S11 7.5 11 10.5C11 13.5 13.5 16 16.5 16S22 13.5 22 10.5Z" />
          <path d="M11 10.5C11 7.5 8.5 5 5.5 5S0 7.5 0 10.5C0 13.5 2.5 16 5.5 16S11 13.5 11 10.5Z" />
          <path d="M5.5 16C5.5 19 8 21.5 11 21.5S16.5 19 16.5 16" />
        </svg>
      </div>
      <span className="font-bold text-xl tracking-tight text-foreground">
        Ocean<span className="text-primary">AI</span>
      </span>
    </div>
  );
};

export default Logo;
