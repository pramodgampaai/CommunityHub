import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (error: any) {
      console.error('Login failed:', error);
      setError(error.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] p-4">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] shadow-sm">
        <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--accent)]">CommunityHub</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Welcome back! Please sign in.</p>
        </div>
        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
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
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;