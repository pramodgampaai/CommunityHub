
import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangleIcon } from '../icons';

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
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full flex-shrink-0 ${isDestructive ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30'}`}>
            <AlertTriangleIcon className="w-6 h-6" />
          </div>
          <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] pt-1 text-sm leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outlined" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={isDestructive ? 'bg-red-600 hover:bg-red-700 text-white border-transparent' : ''}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
