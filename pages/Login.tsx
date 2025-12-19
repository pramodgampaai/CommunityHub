import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import { requestPasswordReset } from '../services/api';
import Logo from '../components/ui/Logo';

type LoginView = 'login' | 'forgot_password';

const LoginPage: React.FC = () => {
  const [view, setView] = useState<LoginView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const { login } = useAuth();

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
              errorMessage = err.message || err.error_description || JSON.stringify(err);
          }
      }
      
      const lowerMsg = errorMessage.toLowerCase();
      if (lowerMsg.includes("invalid login credentials") || lowerMsg.includes("invalid email or password")) {
          errorMessage = "Invalid credentials. Verify your email or contact your property administrator.";
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
        let errorMessage = 'Failed to send reset link. Please try again.';
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

      <div className="w-full max-w-md p-10 sm:p-14 space-y-10 bg-white dark:bg-[#121214] rounded-[3.5rem] border border-[var(--border-light)] dark:border-white/5 shadow-2xl relative z-10">
        <div className="flex flex-col items-center text-center">
            {/* Logo Container - Clean look matching dashboard header */}
            <div className="mb-6">
                <Logo className="w-20 h-20 text-brand-600" />
            </div>
            {/* Brand Title */}
            <h1 className="text-5xl font-brand font-extrabold text-brand-600 tracking-tight">Elevate</h1>
            <p className="font-mono text-[10px] font-bold text-slate-400 dark:text-zinc-500 mt-2 uppercase tracking-[0.4em]">Modern Living Access</p>
            
            {view === 'login' ? (
                <p className="mt-10 text-lg font-medium text-slate-500 dark:text-zinc-400">Welcome back. Please authenticate.</p>
            ) : (
                <p className="mt-10 text-lg font-medium text-slate-500 dark:text-zinc-400">Initialize credential recovery.</p>
            )}
        </div>
        
        {view === 'login' ? (
            <form className="mt-8 space-y-8" onSubmit={handleLoginSubmit}>
            {error && <div className="p-5 text-sm text-red-600 font-bold bg-red-50 dark:bg-red-900/20 rounded-3xl border border-red-100 dark:border-red-800 text-center">{error}</div>}
            <div className="space-y-6">
                <div>
                    <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 ml-2">Email Identity</label>
                    <input
                        type="email"
                        autoComplete="email"
                        required
                        className="input-field block w-full px-6 py-4 rounded-2xl text-base"
                        placeholder="e.g. resident@elevate.com"
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
                <div className="flex items-center justify-end px-2">
                    <button
                        type="button"
                        onClick={() => toggleView('forgot_password')}
                        className="font-mono text-[11px] font-bold text-brand-600 hover:text-brand-700 uppercase tracking-widest transition-colors"
                    >
                        Recover Credentials
                    </button>
                </div>
            </div>

            <div className="pt-2">
                <Button type="submit" size="lg" className="w-full shadow-xl" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Authenticate'}
                </Button>
            </div>
            </form>
        ) : (
            <form className="mt-8 space-y-8" onSubmit={handleForgotSubmit}>
                {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}
                {resetSuccess ? (
                    <div className="text-green-600 dark:text-green-400 text-center text-base font-bold bg-green-50 dark:bg-green-900/20 p-8 rounded-[2.5rem] border border-green-100 dark:border-green-900/30">
                        <p>Recovery link dispatched.</p>
                        <p className="mt-3 text-xs opacity-70 leading-relaxed font-medium">Please inspect your registered inbox for further instructions.</p>
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
                            <Button type="submit" size="lg" className="w-full shadow-xl" disabled={isLoading}>
                                {isLoading ? 'Sending...' : 'Request Recovery'}
                            </Button>
                        </div>
                    </>
                )}
                <div className="text-center pt-2">
                     <button
                        type="button"
                        onClick={() => toggleView('login')}
                        className="font-mono text-[11px] font-bold text-slate-400 hover:text-brand-600 uppercase tracking-widest transition-all"
                    >
                        Back to Portal
                    </button>
                </div>
            </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;