
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Elevate Logo"
    >
      {/* Design: 'The Connected Townships' - Refined High Rise */}
      
      {/* The Unifying Arc (The Community/Platform) */}
      <path
        d="M10 68 Q 50 95 90 68"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.2"
      />

      {/* LEFT: Standalone Apartment (Boxy, Flat Roof) */}
      <rect x="12" y="38" width="24" height="30" fill="currentColor" fillOpacity="0.6" />
      {/* Roof Parapet */}
      <line x1="11" y1="38" x2="37" y2="38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Window Grid to imply floors */}
      <rect x="16" y="43" width="6" height="6" rx="1" fill="white" fillOpacity="0.4" />
      <rect x="26" y="43" width="6" height="6" rx="1" fill="white" fillOpacity="0.4" />
      <rect x="16" y="55" width="6" height="6" rx="1" fill="white" fillOpacity="0.4" />
      <rect x="26" y="55" width="6" height="6" rx="1" fill="white" fillOpacity="0.4" />


      {/* CENTER: High Rise Tower (Tallest, Modern Skyscraper) */}
      {/* Main Body */}
      <rect x="41" y="24" width="18" height="44" fill="currentColor" fillOpacity="0.9" />
      {/* Upper Setback (Penthouse level) */}
      <rect x="44" y="16" width="12" height="8" fill="currentColor" fillOpacity="0.9" />
      {/* Rooftop Antenna */}
      <line x1="50" y1="16" x2="50" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      {/* Horizontal Floor Strips to imply height */}
      <rect x="44" y="28" width="12" height="2" fill="white" fillOpacity="0.3" />
      <rect x="44" y="36" width="12" height="2" fill="white" fillOpacity="0.3" />
      <rect x="44" y="44" width="12" height="2" fill="white" fillOpacity="0.3" />
      <rect x="44" y="52" width="12" height="2" fill="white" fillOpacity="0.3" />
      <rect x="44" y="60" width="12" height="2" fill="white" fillOpacity="0.3" />


      {/* RIGHT: Villa / Duplex (Pitched Roof, House-like) */}
      <path
        d="M64 68 V 48 L 76 36 L 88 48 V 68"
        fill="currentColor"
        fillOpacity="0.7"
      />
      {/* Roof Overhang detail */}
      <path
         d="M62 48 L 76 34 L 90 48"
         fill="none"
         stroke="currentColor"
         strokeWidth="2"
         strokeLinejoin="round"
         strokeLinecap="round"
      />
      {/* Doorway */}
      <rect x="73" y="56" width="6" height="12" fill="white" fillOpacity="0.4" />

      {/* Foundation Line merging them */}
      <rect x="8" y="68" width="84" height="4" rx="2" fill="currentColor" />

    </svg>
  );
};

export default Logo;
