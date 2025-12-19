import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'filled' | 'outlined' | 'fab' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'filled', size = 'md', leftIcon, className = '', ...props }) => {
  const variantClasses = {
    filled: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm border-none',
    outlined: 'bg-white dark:bg-transparent text-brand-600 border-[1.5px] border-brand-500/30 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10',
    fab: 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/20 rounded-full',
    ghost: 'bg-transparent text-[var(--text-secondary-light)] hover:bg-black/5 dark:hover:bg-white/5 border-none'
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-[10px] rounded-lg font-black uppercase tracking-wider',
    md: 'h-10 px-4 text-xs rounded-xl font-bold uppercase tracking-tight',
    lg: 'h-12 px-6 text-sm rounded-xl font-black uppercase tracking-wide',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };
  
  const renderedIcon = leftIcon && React.isValidElement(leftIcon) 
    ? React.cloneElement(leftIcon as React.ReactElement<any>, { 
        className: `shrink-0 ${iconSizes[size]} transition-transform` 
      }) 
    : leftIcon;

  return (
    <motion.button 
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shrink-0 select-none whitespace-nowrap overflow-hidden ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} 
      {...props}
    >
      {renderedIcon}
      <span className="truncate leading-none">{children}</span>
    </motion.button>
  );
};

export default Button;