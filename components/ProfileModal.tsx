
import React, { useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { useAuth } from '../hooks/useAuth';
import { updateUserPassword } from '../services/api';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!user) return null;

    const validatePassword = (pwd: string) => {
        if (pwd.length < 8) return "Password must be at least 8 characters long.";
        if (!/\d/.test(pwd)) return "Password must contain at least one digit.";
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return "Password must contain at least one special character.";
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        
        setError(null);
        setSuccess(null);

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        const validationError = validatePassword(newPassword);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSubmitting(true);

        try {
            await updateUserPassword(newPassword);
            setSuccess("Password updated successfully. Logging out in 2 seconds...");
            
            // Clear fields
            setNewPassword('');
            setConfirmPassword('');

            // Wait for 2 seconds to show the success message, then logout
            setTimeout(async () => {
                onClose();
                await logout();
            }, 2000);

        } catch (err: any) {
            console.error("Profile password update failed:", err);
            setError(err.message || "Failed to update password.");
            setIsSubmitting(false); // Reset on error so user can try again
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setNewPassword('');
            setConfirmPassword('');
            setError(null);
            setSuccess(null);
            onClose();
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="My Profile">
            <div className="space-y-6">
                <div className="flex items-center space-x-4 pb-4 border-b border-[var(--border-light)] dark:border-[var(--border-dark)]">
                    <img className="w-16 h-16 rounded-full ring-2 ring-[var(--accent)]" src={user.avatarUrl} alt={user.name} />
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">{user.name}</h3>
                        <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">{user.email}</p>
                        <div className="flex gap-2 mt-1">
                             <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">{user.role}</span>
                             {user.flatNumber && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300">Flat {user.flatNumber}</span>}
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)] mb-3">Change Password</h4>
                    {error && <div className="mb-3 p-2 text-sm text-red-600 bg-red-100 dark:bg-red-900/20 rounded">{error}</div>}
                    {success && <div className="mb-3 p-2 text-sm text-green-600 bg-green-100 dark:bg-green-900/20 rounded">{success}</div>}
                    
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">New Password</label>
                            <input 
                                type="password" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                                className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent sm:text-sm"
                                placeholder="At least 8 chars, 1 digit, 1 symbol"
                                disabled={isSubmitting}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">Confirm Password</label>
                            <input 
                                type="password" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent sm:text-sm"
                                disabled={isSubmitting}
                                required
                            />
                        </div>
                        <div className="pt-2 flex justify-end">
                             <Button type="submit" disabled={isSubmitting || (!newPassword && !success) || (!confirmPassword && !success)}>
                                {success ? 'Success!' : (isSubmitting ? 'Updating...' : 'Update Password')}
                             </Button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
};

export default ProfileModal;
