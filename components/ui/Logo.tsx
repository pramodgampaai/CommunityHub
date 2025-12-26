
import React from 'react';

interface LogoProps {
  className?: string;
  color?: string; // Optional override for specific inline color
}

const Logo: React.FC<LogoProps> = ({ className, color = "currentColor" }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Nilayam Logo"
    >
      {/* Design: 'The Connected Townships' - Refined Human-Centric Style */}
      
      {/* The Unifying Arc - Dynamic Connection */}
      <path
        d="M10 68 Q 50 95 90 68"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.25"
      />

      {/* LEFT: Residential Block (Humanist Rounded Rect) */}
      <rect x="14" y="42" width="22" height="26" rx="3" fill={color} fillOpacity="0.6" />
      <rect x="18" y="48" width="4" height="4" rx="1" fill="white" fillOpacity="0.8" />
      <rect x="28" y="48" width="4" height="4" rx="1" fill="white" fillOpacity="0.8" />
      <rect x="18" y="58" width="4" height="4" rx="1" fill="white" fillOpacity="0.8" />
      <rect x="28" y="58" width="4" height="4" rx="1" fill="white" fillOpacity="0.8" />


      {/* CENTER: The Spire (Highest Elevation) */}
      <path 
        d="M42 68 V 32 Q 42 28 46 28 H 54 Q 58 28 58 32 V 68 H 42Z" 
        fill={color} 
        fillOpacity="0.9" 
      />
      <rect x="46" y="36" width="8" height="2" rx="0.5" fill="white" fillOpacity="0.3" />
      <rect x="46" y="44" width="8" height="2" rx="0.5" fill="white" fillOpacity="0.3" />
      <rect x="46" y="52" width="8" height="2" rx="0.5" fill="white" fillOpacity="0.3" />
      <rect x="46" y="60" width="8" height="2" rx="0.5" fill="white" fillOpacity="0.3" />


      {/* RIGHT: Villa / Home (Soft Pitch) */}
      <path
        d="M66 68 V 52 L 78 40 L 90 52 V 68 H 66Z"
        fill={color} 
        fillOpacity="0.75"
      />
      <rect x="75" y="58" width="6" height="10" rx="1" fill="white" fillOpacity="0.5" />

      {/* Ground Foundation */}
      <rect x="8" y="68" width="84" height="4" rx="2" fill={color} />

    </svg>
  );
};

export default Logo;
