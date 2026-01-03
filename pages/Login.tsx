
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import { requestPasswordReset } from '../services/api';
import Logo from '../components/ui/Logo';
import { AlertTriangleIcon } from '../components/icons';
import { motion, AnimatePresence } from 'framer-motion';

type LoginView = 'login' | 'forgot_password';

const LoginPage: React.FC = () => {
  const [view, setView] = useState<LoginView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const { login } = useAuth();

  // Clear error when user interacts with inputs or switches view
  useEffect(() => {
    if (error) setError(null);
  }, [email, password, view]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      console.error('Login failed:', err);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      if (err) {
          if (typeof err === 'string') {
              errorMessage = err;
          } else if (typeof err === 'object') {
              // Handle structured AuthError objects
              errorMessage = err.message || err.error_description || err.description || JSON.stringify(err);
          }
      }
      
      const lowerMsg = errorMessage.toLowerCase();
      // Simplify common auth errors for end-users
      if (
          lowerMsg.includes("invalid login credentials") || 
          lowerMsg.includes("invalid email or password") ||
          lowerMsg.includes("invalid_credentials")
      ) {
          errorMessage = "Invalid credentials. Please verify your email and security key.";
      } else if (lowerMsg.includes("email not confirmed")) {
          errorMessage = "Account registration is pending confirmation. Please check your inbox.";
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResetSuccess(false);
    try {
        await requestPasswordReset(email);
        setResetSuccess(true);
    } catch (err: any) {
        console.error('Password reset request failed:', err);
        let errorMessage = 'Failed to send reset link. Please verify the email address.';
        if (err && typeof err === 'object' && 'message' in err) {
            errorMessage = String(err.message);
        }
        setError(errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  const toggleView = (newView: LoginView) => {
      setView(newView);
      setError(null);
      setResetSuccess(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] p-4 relative overflow-hidden">
      {/* Background Architectural Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(var(--text-light) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      {/* Main Login Container */}
      <div className="w-full max-w-md flex flex-col justify-center p-10 sm:p-14 space-y-10 bg-white dark:bg-[#121214] rounded-[3.5rem] border border-[var(--border-light)] dark:border-white/5 shadow-2xl relative z-10 animate-fadeIn">
        <div className="flex flex-col items-center text-center">
            {/* Logo */}
            <div className="mb-6 relative">
                <Logo className="w-14 h-14 text-brand-600 relative z-10" />
            </div>
            
            {/* Brand Title */}
            <h1 className="text-3xl font-brand font-extrabold text-brand-600 tracking-tightest">Nilayam</h1>
            
            {/* Tagline */}
            <div className="mt-2.5">
                <p className="font-brand text-[9px] font-bold uppercase tracking-[0.4em] text-brand-600">
                    Your Abode <span className="opacity-30 mx-1 font-light">|</span> Managed
                </p>
            </div>
            
            <div className="mt-8">
                <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
                    {view === 'login' ? 'Welcome back. Please authenticate.' : 'Initialize credential recovery.'}
                </p>
            </div>
        </div>
        
        {/* Focused Error Display */}
        <AnimatePresence mode="wait">
            {error && (
                <motion.div 
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3 shadow-sm"
                >
                    <AlertTriangleIcon className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                    <p className="text-xs font-bold text-rose-800 dark:text-rose-200 leading-relaxed">
                        {error}
                    </p>
                </motion.div>
            )}
        </AnimatePresence>
        
        {view === 'login' ? (
            <form className="mt-2 space-y-8" onSubmit={handleLoginSubmit}>
                <div className="space-y-6">
                    <div>
                        <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-2">Email Identity</label>
                        <input
                            type="email"
                            autoComplete="email"
                            required
                            className="input-field block w-full px-6 py-4 rounded-2xl text-base"
                            placeholder="resident@nilayam.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-2">Security Key</label>
                        <input
                            type="password"
                            autoComplete="current-password"
                            required
                            className="input-field block w-full px-6 py-4 rounded-2xl text-base"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center justify-end px-2 pt-1">
                        <button
                            type="button"
                            onClick={() => toggleView('forgot_password')}
                            className="font-mono text-[10px] font-bold text-brand-600 hover:text-brand-700 uppercase tracking-widest transition-colors"
                        >
                            Recover Credentials
                        </button>
                    </div>
                </div>

                <div className="pt-2">
                    <Button type="submit" size="lg" className="w-full shadow-xl rounded-2xl h-14" disabled={isLoading}>
                        {isLoading ? 'Verifying...' : 'Authenticate'}
                    </Button>
                </div>
            </form>
        ) : (
            <form className="mt-2 space-y-8" onSubmit={handleForgotSubmit}>
                {resetSuccess ? (
                    <div className="text-green-600 dark:text-green-400 text-center bg-green-50 dark:bg-green-900/10 p-8 rounded-[2.5rem] border border-green-100 dark:border-green-900/20">
                        <p className="text-sm font-bold uppercase tracking-widest">Link Dispatched</p>
                        <p className="mt-3 text-[11px] opacity-70 leading-relaxed font-medium">Please inspect your registered inbox for further instructions.</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-6">
                            <div>
                                <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-2">Registration Email</label>
                                <input
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="input-field block w-full px-6 py-4 rounded-2xl text-base"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="pt-2">
                            <Button type="submit" size="lg" className="w-full shadow-xl rounded-2xl h-14" disabled={isLoading}>
                                {isLoading ? 'Sending...' : 'Request Recovery'}
                            </Button>
                        </div>
                    </>
                )}
                <div className="text-center pt-2">
                     <button
                        type="button"
                        onClick={() => toggleView('login')}
                        className="font-mono text-[10px] font-bold text-slate-400 hover:text-brand-600 uppercase tracking-widest transition-all"
                    >
                        Back to Portal
                    </button>
                </div>
            </form>
        )}

        <div className="pt-8 text-center border-t border-slate-50 dark:border-white/5 opacity-30">
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
