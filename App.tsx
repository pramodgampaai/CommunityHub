

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
import Maintenance from './pages/Maintenance';
import Expenses from './pages/Expenses';
import type { Page } from './types';
import { UserRole } from './types';
import Spinner from './components/ui/Spinner';
import { isSupabaseConfigured } from './services/supabase';

export type Theme = 'light' | 'dark';

function App() {
  const { user, loading } = useAuth();
  // Initialize activePage safely
  const [activePage, setActivePage] = useState<Page>('Dashboard');
  const [pageParams, setPageParams] = useState<any>(null);
  
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
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Enforce Role-Based Page Access (Redirect Logic)
  useEffect(() => {
    if (user) {
      if (user.role === UserRole.HelpdeskAgent) {
          // Agents only allowed on Notices and Help Desk
          const allowed = ['Notices', 'Help Desk'];
          if (!allowed.includes(activePage)) {
            setActivePage('Help Desk');
          }
      } else if (user.role === UserRole.HelpdeskAdmin) {
          // Helpdesk Admin allowed on these pages (Maintenance Removed)
          const allowed = ['Notices', 'Help Desk', 'Directory'];
          if (!allowed.includes(activePage)) {
            setActivePage('Help Desk');
          }
      } else if (user.role !== UserRole.Admin && activePage === 'Expenses') {
          // Only Admin can see Expenses
          setActivePage('Dashboard');
      }
    }
  }, [user, activePage]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const navigateToPage = (page: Page, params?: any) => {
      setPageParams(params || null);
      setActivePage(page);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] p-4">
        <div className="w-full max-w-2xl p-8 text-center bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] rounded-xl border border-[var(--border-light)] dark:border-[var(--border-dark)] shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Configuration Required</h1>
          <p className="mt-4 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">
            Your Supabase URL and Key are needed to connect to the backend.
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

  // Role-based routing
  if (user.role === UserRole.SuperAdmin) {
    return <AdminPanel theme={theme} toggleTheme={toggleTheme} />;
  }
  
  // Define allowed pages per role for rendering check
  let allowedPages: Page[] = ['Dashboard', 'Notices', 'Help Desk', 'Visitors', 'Amenities', 'Directory', 'Maintenance'];
  
  if (user.role === UserRole.HelpdeskAgent) {
      allowedPages = ['Notices', 'Help Desk'];
  } else if (user.role === UserRole.HelpdeskAdmin) {
      allowedPages = ['Notices', 'Help Desk', 'Directory'];
  } else if (user.role === UserRole.Admin) {
      // Admins have access to everything including Expenses
      allowedPages.push('Expenses');
  }

  // If the user is on a restricted page, don't render content, just wait for useEffect to redirect
  // We render the Layout with a spinner to maintain context/theme
  if (!allowedPages.includes(activePage)) {
      return (
        <Layout activePage={activePage} setActivePage={setActivePage} theme={theme} toggleTheme={toggleTheme}>
             <div className="flex justify-center items-center h-64">
                <Spinner />
             </div>
        </Layout>
      );
  }

  const renderContent = () => {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard navigateToPage={navigateToPage} />;
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
      case 'Maintenance':
        return <Maintenance initialFilter={pageParams?.filter} />;
      case 'Expenses':
        return <Expenses />;
      default:
        return <Dashboard navigateToPage={navigateToPage} />;
    }
  };

  return (
    <Layout activePage={activePage} setActivePage={setActivePage} theme={theme} toggleTheme={toggleTheme}>
      {renderContent()}
    </Layout>
  );
}

export default App;