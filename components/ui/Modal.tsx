import React, { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from '../icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string; 
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  subtitle = "SYSTEM ACTION", 
  children, 
  footer, 
  size = 'md' 
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted) return null;

  const sizeClasses = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl'
  };

  // Fix: Cast motion.div to any to resolve property 'initial', 'animate', 'exit' missing errors in environments with broken lib types
  const MotionDiv = motion.div as any;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 overflow-hidden">
          <MotionDiv 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm" 
            onClick={onClose} 
          />
          
          <MotionDiv 
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className={`bg-white dark:bg-[var(--modal-bg-dark)] rounded-xl shadow-2xl w-full sm:${sizeClasses[size]} flex flex-col max-h-[90vh] relative z-10 border border-slate-100 dark:border-white/5 overflow-hidden`} 
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-5 sm:p-6 pb-2 shrink-0">
              <div className="flex items-start gap-3">
                <div className="w-1 h-8 bg-brand-500 rounded-full mt-1 opacity-90" />
                
                <div className="flex flex-col">
                  <span className="font-mono text-[8px] font-black uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-0.5">
                    {subtitle}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-brand font-extrabold text-brand-600 dark:text-slate-50 tracking-tight leading-tight">
                    {title}
                  </h3>
                </div>
              </div>

              <button 
                onClick={onClose} 
                className="text-slate-400 dark:text-[var(--text-secondary-dark)] hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg p-1.5 transition-all group"
                aria-label="Close modal"
              >
                <XIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            <div className="px-5 sm:px-6 pb-6 pt-2 overflow-y-auto flex-1 no-scrollbar text-sm">
              {children}
            </div>

            {footer && (
              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-white/5 shrink-0 bg-slate-50/50 dark:bg-white/[0.01]">
                 {footer}
              </div>
            )}
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>
  );

  const root = document.getElementById('modal-root');
  return root ? createPortal(modalContent, root) : null;
};

export default Modal;