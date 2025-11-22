
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
            // 1. Update password via Edge Function (Server Side)
            await updateUserPassword(newPassword);
            
            // 2. Show success message
            setSuccess("Password updated successfully. You will be logged out.");
            
            // 3. Logout after delay
            // We use the robust logout function from useAuth which handles the hard reload
            setTimeout(async () => {
                await logout();
            }, 2000);

        } catch (err: any) {
            console.error("Password update failed:", err);
            setError(err.message || "Failed to update password. Please try again.");
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting && !success) {
            setNewPassword('');
            setConfirmPassword('');
            setError(null);
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
                        </div>
                    </div>
                </div>

                {/* Units Information Section */}
                {user.role === 'Resident' && user.units && user.units.length > 0 && (
                    <div className="bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] rounded-lg p-4 border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                        <h4 className="font-semibold text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-3 uppercase tracking-wider">My Units ({user.units.length})</h4>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                            {user.units.map((unit) => (
                                <div key={unit.id} className="flex justify-between items-center bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] p-3 rounded border border-[var(--border-light)] dark:border-[var(--border-dark)] shadow-sm">
                                    <div>
                                        <p className="font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">
                                            {unit.block ? `${unit.block} - ` : ''}{unit.flatNumber}
                                        </p>
                                        <p className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                                            {unit.floor ? `Floor ${unit.floor}` : ''} 
                                            {unit.floor && unit.flatSize ? ' • ' : ''}
                                            {unit.flatSize ? `${unit.flatSize} sq ft` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Active</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Fallback for Staff Location */}
                {user.role !== 'Resident' && user.flatNumber && (
                    <div className="bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] rounded-lg p-4 border border-[var(--border-light)] dark:border-[var(--border-dark)]">
                        <p className="text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Location / Desk</p>
                        <p className="font-bold text-[var(--text-light)] dark:text-[var(--text-dark)]">{user.flatNumber}</p>
                    </div>
                )}

                <div>
                    <h4 className="font-medium text-[var(--text-light)] dark:text-[var(--text-dark)] mb-3 pt-2">Change Password</h4>
                    {error && <div className="mb-3 p-3 text-sm text-red-600 bg-red-100 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">{error}</div>}
                    {success && <div className="mb-3 p-3 text-sm text-green-600 bg-green-100 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">{success}</div>}
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mb-1">New Password</label>
                            <input 
                                type="password" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                                className="block w-full px-3 py-2 border border-[var(--border-light)] dark:border-[var(--border-dark)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-transparent sm:text-sm"
                                placeholder="At least 8 chars, 1 digit, 1 symbol"
                                disabled={isSubmitting || success !== null}
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
                                disabled={isSubmitting || success !== null}
                                required
                            />
                        </div>
                        <div className="pt-2 flex justify-end">
                             <Button type="submit" disabled={isSubmitting || success !== null}>
                                {isSubmitting ? 'Updating...' : (success ? 'Done' : 'Update Password')}
                             </Button>
                        </div>
                    </form>
                </div>
            </div>
        </Modal>
    );
};

export default ProfileModal;
