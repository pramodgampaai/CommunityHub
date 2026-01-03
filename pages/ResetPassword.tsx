
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateUserPassword } from '../services/api';
import Button from '../components/ui/Button';
import Logo from '../components/ui/Logo';
import { CheckCircleIcon, AlertTriangleIcon } from '../components/icons';

const ResetPassword: React.FC = () => {
    const { logout } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const validatePassword = (pwd: string) => {
        if (pwd.length < 8) return "Password must be at least 8 characters long.";
        if (!/\d/.test(pwd)) return "Password must contain at least one digit.";
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return "Password must contain at least one special character.";
        return null;
    };

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Confirmation password does not match.");
            return;
        }

        const strengthError = validatePassword(password);
        if (strengthError) {
            setError(strengthError);
            return;
        }

        setIsLoading(true);
        try {
            await updateUserPassword(password);
            setSuccess(true);
            // Wait 2 seconds then redirect to login (via logout)
            setTimeout(async () => {
                await logout();
            }, 2500);
        } catch (err: any) {
            console.error("Reset failed:", err);
            setError(err.message || "Failed to update security credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] p-4 relative overflow-hidden">
            <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(var(--text-light) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            </div>

            <div className="w-full max-w-md flex flex-col justify-center p-10 sm:p-14 space-y-8 bg-white dark:bg-[#121214] rounded-[3.5rem] border border-[var(--border-light)] dark:border-white/5 shadow-2xl relative z-10">
                <div className="flex flex-col items-center text-center">
                    <Logo className="w-14 h-14 text-brand-600 mb-6" />
                    <h1 className="text-3xl font-brand font-extrabold text-brand-600 tracking-tightest">Secure Access</h1>
                    <p className="mt-4 text-sm font-medium text-slate-500 dark:text-zinc-400">Initialize your new security credentials below.</p>
                </div>

                {success ? (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="p-8 rounded-[2.5rem] bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 text-center">
                            <div className="w-12 h-12 bg-white dark:bg-emerald-500/20 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                                <CheckCircleIcon className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="text-base font-bold text-emerald-800 dark:text-emerald-200">Credentials Secured</p>
                            <p className="text-xs text-emerald-600/70 mt-2 font-medium">Password updated. Returning to portal...</p>
                        </div>
                    </div>
                ) : (
                    <form className="space-y-6" onSubmit={handleResetSubmit}>
                        {error && (
                            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3">
                                <AlertTriangleIcon className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                                <p className="text-xs font-bold text-rose-800 dark:text-rose-200 leading-relaxed">{error}</p>
                            </div>
                        )}

                        <div>
                            <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-2">New Security Key</label>
                            <input
                                type="password"
                                required
                                className="input-field block w-full px-6 py-4 rounded-2xl text-base"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-2">Confirm Key</label>
                            <input
                                type="password"
                                required
                                className="input-field block w-full px-6 py-4 rounded-2xl text-base"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        <div className="pt-4">
                            <Button type="submit" size="lg" className="w-full shadow-xl rounded-2xl h-14" disabled={isLoading}>
                                {isLoading ? 'Transmitting...' : 'Update & Authenticate'}
                            </Button>
                        </div>
                    </form>
                )}

                <div className="pt-6 text-center">
                    <button
                        onClick={() => window.location.href = '/'}
                        className="font-mono text-[10px] font-bold text-slate-400 hover:text-brand-600 uppercase tracking-widest transition-all"
                    >
                        Back to Portal
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
