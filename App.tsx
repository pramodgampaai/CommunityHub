import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import NoticeBoard from './pages/NoticeBoard';
import HelpDesk from './pages/HelpDesk';
import Visitors from './pages/Visitors';
import Amenities from './pages/Amenities';
import type { Page } from './types';
import Spinner from './components/ui/Spinner';
import { isSupabaseConfigured } from './services/supabase';

export type Theme = 'light' | 'dark';

function App() {
  const { user, loading } = useAuth();
  const [activePage, setActivePage] = useState<Page>('Dashboard');
  const [theme, setTheme] = useState<Theme>(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] p-4">
        <div className="w-full max-w-lg p-8 text-center bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Configuration Error</h1>
          <p className="mt-4 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
            Supabase URL and Key are not configured. The application cannot connect to the backend.
          </p>
          <p className="mt-2 text-sm text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
            Please add VITE_SUPABASE_URL and VITE_SUPABASE_KEY to your environment variables or Vercel project settings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Notices':
        return <NoticeBoard />;
      case 'Help Desk':
        return <HelpDesk />;
      case 'Visitors':
        return <Visitors />;
      case 'Amenities':
        return <Amenities />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activePage={activePage} setActivePage={setActivePage} theme={theme} toggleTheme={toggleTheme}>
      {renderContent()}
    </Layout>
  );
}

export default App;