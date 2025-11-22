
import React, { ReactNode } from 'react';
import { XIcon } from '../icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 flex justify-center items-center p-4 modal-backdrop" onClick={onClose}>
      <div 
        className="bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh] transform transition-all modal-content" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-[var(--border-light)] dark:border-[var(--border-dark)] shrink-0">
          <h3 className="text-lg font-medium text-[var(--text-light)] dark:text-[var(--text-dark)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-black/5 dark:hover:bg-white/5 rounded-full p-1.5 transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="p-4 border-t border-[var(--border-light)] dark:border-[var(--border-dark)] shrink-0 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-b-lg">
             {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
