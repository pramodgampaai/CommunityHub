import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'filled' | 'outlined' | 'fab';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'filled', size = 'md', leftIcon, className, ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium focus:outline-none focus:ring-4 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md';

  const variantClasses = {
    filled: 'bg-googleBlue-500 hover:bg-googleBlue-600 text-white focus:ring-googleBlue-500/30 border border-transparent',
    outlined: 'bg-transparent text-googleBlue-500 border border-current hover:bg-googleBlue-500/10 focus:ring-googleBlue-500/30',
    fab: 'bg-googleBlue-500 hover:bg-googleBlue-600 text-white focus:ring-googleBlue-500/30 border border-transparent rounded-full px-6',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-5 py-2.5 text-sm rounded-lg',
    lg: 'px-6 py-3 text-base rounded-lg',
  };
  
  const fabSizeClasses = {
    sm: 'h-10 px-4 text-sm',
    md: 'h-12 px-6 text-sm',
    lg: 'h-14 px-8 text-base',
  };


  const currentSizeClasses = variant === 'fab' ? fabSizeClasses[size] : sizeClasses[size];

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${currentSizeClasses} ${className}`;

  return (
    <button className={combinedClasses} {...props}>
      {leftIcon && <span className="mr-2 -ml-1">{leftIcon}</span>}
      {children}
    </button>
  );
};

export default Button;