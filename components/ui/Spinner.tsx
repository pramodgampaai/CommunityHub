
import React from 'react';

interface SpinnerProps {
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ className = '' }) => {
  // If the caller provides width or height, we let the inner ring fill that container.
  // Otherwise, we provide a sensible default size for standalone loaders.
  const isSized = className.includes('w-') || className.includes('h-');
  
  return (
    <div className={`inline-flex items-center justify-center gpu-accelerated relative ${isSized ? '' : 'w-6 h-6'} ${className}`}>
      {/* Background ring */}
      <div
        className="w-full h-full border-[2.5px] border-current opacity-20 rounded-full"
      ></div>
      {/* Spinning head */}
      <div
        className="absolute inset-0 w-full h-full border-[2.5px] border-transparent border-t-current rounded-full animate-spin"
        style={{ animationDuration: '0.6s' }}
      ></div>
    </div>
  );
};

export default Spinner;
