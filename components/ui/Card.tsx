import React from 'react';
import { motion } from 'framer-motion';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
  delay?: number;
  layout?: boolean;
}

// Destructure motion-conflicting props from the spread to avoid TypeScript errors with framer-motion
const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  style, 
  noPadding = false, 
  delay = 0, 
  layout = false,
  onAnimationStart,
  onDrag,
  onDragStart,
  onDragEnd,
  ...props 
}) => {
  // Fix: Cast motion.div to any to resolve property 'layout' and motion-specific props missing errors
  const MotionDiv = motion.div as any;

  return (
    <MotionDiv
      layout={layout}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      whileHover={{ 
        y: -1, 
        boxShadow: '0 10px 20px -10px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)' 
      }}
      className={`glass rounded-2xl shadow-premium overflow-hidden transition-all duration-300 ${noPadding ? '' : 'p-4 sm:p-5'} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </MotionDiv>
  );
};

export default Card;