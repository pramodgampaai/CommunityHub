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
            case 'success': return <CheckCircleIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />;
            case 'error': return <AlertTriangleIcon className="w-8 h-8 text-rose-600 dark:text-rose-400" />;
            default: return <AlertTriangleIcon className="w-8 h-8 text-brand-600 dark:text-brand-400" />;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success': return 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20';
            case 'error': return 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20';
            default: return 'bg-brand-50 dark:bg-brand-900/10 border-brand-100 dark:border-brand-900/20';
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle="SYSTEM NOTIFICATION" size="sm">
            <div className="space-y-8">
                <div className={`p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-4 border ${getColors()}`}>
                    <div className="p-3 bg-white dark:bg-black/20 rounded-2xl shadow-sm">{getIcon()}</div>
                    <p className="text-base font-semibold text-slate-800 dark:text-[var(--text-dark)] leading-relaxed">{message}</p>
                </div>
                <div className="flex justify-center px-2">
                    <Button onClick={onClose} className="w-full" size="lg" leftIcon={<CheckCircleIcon />}>Acknowledge</Button>
                </div>
            </div>
        </Modal>
    );
};

export default FeedbackModal;