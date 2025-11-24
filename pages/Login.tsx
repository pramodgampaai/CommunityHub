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
      if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String(err.message);
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
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03] dark:opacity-[0.05]">
          <Logo className="w-[120vw] h-[120vw] text-[var(--text-light)] dark:text-[var(--text-dark)]" />
      </div>

      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] shadow-sm relative z-10">
        <div className="flex flex-col items-center text-center">
            <Logo className="w-16 h-16 text-[var(--accent)] mb-3" />
            <h1 className="text-4xl font-brand font-bold text-brand-500 tracking-wide">Elevate</h1>
            <p className="text-xs sm:text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] mt-1 uppercase tracking-wide">Community Living, Elevated</p>
            {view === 'login' ? (
                <p className="mt-6 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Welcome back! Please sign in.</p>
            ) : (
                <p className="mt-6 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Reset your password</p>
            )}
        </div>
        
        {view === 'login' ? (
            <form className="mt-6 space-y-6" onSubmit={handleLoginSubmit}>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div className="space-y-4">
                <div>
                <label htmlFor="email-address" className="sr-only">Email address</label>
                <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="relative block w-full px-3 py-2.5 border border-[var(--border-light)] dark:border-[var(--border-dark)] placeholder-[var(--text-secondary-light)] dark:placeholder-[var(--text-secondary-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-bg-light)] dark:focus:ring-offset-[var(--card-bg-dark)] focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                </div>
                <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="relative block w-full px-3 py-2.5 border border-[var(--border-light)] dark:border-[var(--border-dark)] placeholder-[var(--text-secondary-light)] dark:placeholder-[var(--text-secondary-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-bg-light)] dark:focus:ring-offset-[var(--card-bg-dark)] focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                </div>
                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        onClick={() => toggleView('forgot_password')}
                        className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
                    >
                        Forgot Password?
                    </button>
                </div>
            </div>

            <div className="pt-2">
                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
            </div>
            </form>
        ) : (
            <form className="mt-6 space-y-6" onSubmit={handleForgotSubmit}>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                {resetSuccess ? (
                    <div className="text-green-600 dark:text-green-400 text-center text-sm bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                        <p>Password reset link sent!</p>
                        <p className="mt-1">Check your email for instructions.</p>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] text-center">
                            Enter your email address and we'll send you a link to reset your password.
                        </p>
                        <div>
                            <label htmlFor="reset-email" className="sr-only">Email address</label>
                            <input
                                id="reset-email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="relative block w-full px-3 py-2.5 border border-[var(--border-light)] dark:border-[var(--border-dark)] placeholder-[var(--text-secondary-light)] dark:placeholder-[var(--text-secondary-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--card-bg-light)] dark:focus:ring-offset-[var(--card-bg-dark)] focus:ring-[var(--accent)] focus:border-[var(--accent)] sm:text-sm"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="pt-2">
                            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                                {isLoading ? 'Sending Link...' : 'Send Reset Link'}
                            </Button>
                        </div>
                    </>
                )}
                <div className="text-center pt-2">
                     <button
                        type="button"
                        onClick={() => toggleView('login')}
                        className="text-sm font-medium text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-[var(--text-light)] dark:hover:text-[var(--text-dark)] transition-colors"
                    >
                        Back to Sign In
                    </button>
                </div>
            </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;