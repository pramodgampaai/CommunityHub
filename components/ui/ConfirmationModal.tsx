import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangleIcon, CheckCircleIcon, XIcon } from '../icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle="SECURITY PROTOCOL">
      <div className="space-y-8">
        <div className="flex items-start gap-5 p-8 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-slate-100 dark:border-white/5">
          <div className={`p-4 rounded-2xl flex-shrink-0 shadow-sm ${isDestructive ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30' : 'bg-brand-50 text-brand-600 dark:bg-brand-900/30'}`}>
            <AlertTriangleIcon className="w-8 h-8" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-slate-900 dark:text-[var(--text-dark)] font-bold text-xl leading-snug tracking-tight">Attention Required</p>
            <p className="text-slate-500 dark:text-[var(--text-secondary-dark)] text-base leading-relaxed font-medium">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-2">
          <Button variant="ghost" onClick={onClose} disabled={isLoading} size="md" leftIcon={<XIcon />}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            size="md"
            leftIcon={<CheckCircleIcon />}
            className={`${isDestructive ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;