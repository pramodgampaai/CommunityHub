import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({ children, className, style }) => {
  const cardClasses = `bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-xl shadow-sm overflow-hidden transition-shadow duration-300 border border-[var(--border-light)] dark:border-[var(--border-dark)] hover:shadow-md ${className}`;
  return (
    <div className={cardClasses} style={style}>
      {children}
    </div>
  );
};

export default Card;