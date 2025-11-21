
import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import NoticeBoard from './pages/NoticeBoard';
import HelpDesk from './pages/HelpDesk';
import Visitors from './pages/Visitors';
import Amenities from './pages/Amenities';
import AdminPanel from './pages/AdminPanel';
import Directory from './pages/Directory';
import type { Page } from './types';
import { UserRole } from './types';
import Spinner from './components/ui/Spinner';
import { isSupabaseConfigured } from './services/supabase';

export type Theme = 'light' | 'dark';

function App() {
  const { user, loading } = useAuth();
  const [activePage, setActivePage] = useState<Page>('Dashboard');
  
  // Initialize theme from localStorage or fallback to system preference
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      return savedTheme;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Remove both potential classes to ensure a clean state before adding the current one
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Enforce Role-Based Page Access
  useEffect(() => {
    // Restrict Helpdesk Admin AND Helpdesk Agent
    if (user?.role === UserRole.Helpdesk || user?.role === UserRole.HelpdeskAgent) {
      const allowedPages: Page[] = ['Notices', 'Help Desk'];
      // Prevent flash of Dashboard or other pages
      if (!allowedPages.includes(activePage)) {
        setActivePage('Help Desk');
      }
    }
  }, [user, activePage]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] p-4">
        <div className="w-full max-w-2xl p-8 text-center bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Configuration Required</h1>
          <p className="mt-4 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
            Your Supabase URL and Key are needed to connect to the backend.
          </p>
           <div className="mt-4 text-sm text-left bg-black/5 dark:bg-white/5 p-4 rounded-md space-y-3">
            <div>
              <strong className="font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">For Vercel/Netlify Deployment:</strong>
              <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Set these environment variables in your project settings:</p>
              <ul className="list-disc list-inside mt-1 pl-2 font-mono">
                <li>VITE_SUPABASE_URL</li>
                <li>VITE_SUPABASE_KEY</li>
              </ul>
            </div>
             <div>
              <strong className="font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)]">For AI Studio Preview:</strong>
               <p className="text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
                Open <code className="font-mono bg-gray-200 dark:bg-gray-700 p-1 rounded">services/supabase.ts</code> and replace the placeholder values.
              </p>
            </div>
          </div>
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

  // Role-based routing
  if (user.role === UserRole.SuperAdmin) {
    return <AdminPanel theme={theme} toggleTheme={toggleTheme} />;
  }
  
  // Security check for Helpdesk users
  // Prevents rendering unauthorized pages even for a split second before the useEffect redirect kicks in
  if (user.role === UserRole.Helpdesk || user.role === UserRole.HelpdeskAgent) {
      const allowedPages: Page[] = ['Notices', 'Help Desk'];
      if (!allowedPages.includes(activePage)) {
          return (
            <Layout activePage={activePage} setActivePage={setActivePage} theme={theme} toggleTheme={toggleTheme}>
                 <div className="flex justify-center items-center h-64">
                    <Spinner />
                 </div>
            </Layout>
          );
      }
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
      case 'Directory':
        return <Directory />;
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
