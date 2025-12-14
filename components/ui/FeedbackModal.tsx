
import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { CheckCircleIcon, AlertTriangleIcon } from '../icons';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info';
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, title, message, type = 'info' }) => {
    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />;
            case 'error': return <AlertTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />;
            default: return <AlertTriangleIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
        }
    };

    const getBgColor = () => {
        switch (type) {
            case 'success': return 'bg-green-50 dark:bg-green-900/20';
            case 'error': return 'bg-red-50 dark:bg-red-900/20';
            default: return 'bg-blue-50 dark:bg-blue-900/20';
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <div className="space-y-4">
                <div className={`p-4 rounded-lg flex items-start gap-3 ${getBgColor()}`}>
                    <div className="flex-shrink-0 mt-0.5">
                        {getIcon()}
                    </div>
                    <p className="text-sm text-[var(--text-light)] dark:text-[var(--text-dark)]">{message}</p>
                </div>
                <div className="flex justify-end">
                    <Button onClick={onClose}>OK</Button>
                </div>
            </div>
        </Modal>
    );
};

export default FeedbackModal;
