
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
  return (
    <motion.div
      layout={layout}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ 
        duration: 0.15, 
        delay, 
        ease: "linear" 
      }}
      className={`glass rounded-2xl shadow-premium overflow-hidden ${noPadding ? '' : 'p-4 sm:p-5'} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;
