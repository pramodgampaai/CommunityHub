
import React, { useState, useEffect, useMemo } from 'react';
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
import CommunitySetup from './pages/CommunitySetup';
import Billing from './pages/Billing';
import BulkOperations from './pages/BulkOperations';
import type { Page } from './types';
import { UserRole } from './types';
import Spinner from './components/ui/Spinner';
import { isSupabaseConfigured } from './services/supabase';
import { updateTheme } from './services/api';

export type Theme = 'light' | 'dark';

function App() {
  const { user, loading, refreshUser } = useAuth();
  
  // Initialize activePage from localStorage
  const [activePage, setActivePage] = useState<Page>(() => {
      const savedPage = localStorage.getItem('nilayam_last_page');
      return (savedPage as Page) || 'Dashboard';
  });
  
  const [pageParams, setPageParams] = useState<any>(null);
  
  // Persist the active page
  useEffect(() => {
      if (activePage) {
          localStorage.setItem('nilayam_last_page', activePage);
      }
  }, [activePage]);
  
  const [theme, setTheme] = useState<Theme>('light');

  // Initial Theme Setup
  useEffect(() => {
    if (!user) {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    } else if (user.theme) {
        setTheme(user.theme);
    }
  }, [user]);

  // Apply theme to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  /**
   * Synchronous Access Control Logic
   * We calculate the "Real" page the user should be on based on their data.
   * This prevents the "Double Load" by ensuring we never render a restricted page
   * even for a single frame.
   */
  const resolvedPage = useMemo((): Page => {
    if (!user) return activePage;

    // 1. Mandatory Setup Redirects (No more async check here)
    // We check user.units directly which is populated by useAuth
    const hasUnits = user.units && user.units.length > 0;
    
    // Admins and Residents MUST have units to use the app
    if ((user.role === UserRole.Admin || user.role === UserRole.Resident) && !hasUnits) {
        return 'CommunitySetup';
    }

    // 2. Role-Based Page Access
    const role = user.role;
    
    if (role === UserRole.SuperAdmin) {
        return ['Dashboard', 'Billing'].includes(activePage) ? activePage : 'Dashboard';
    }

    if (role === UserRole.HelpdeskAgent) {
        return ['Notices', 'Help Desk'].includes(activePage) ? activePage : 'Help Desk';
    }

    if (role === UserRole.HelpdeskAdmin) {
        return ['Notices', 'Help Desk', 'Directory'].includes(activePage) ? activePage : 'Help Desk';
    }

    if (role === UserRole.SecurityAdmin) {
        return ['Notices', 'Visitors', 'Directory'].includes(activePage) ? activePage : 'Visitors';
    }

    if (role === UserRole.Security) {
        return ['Notices', 'Visitors'].includes(activePage) ? activePage : 'Visitors';
    }

    if (role === UserRole.Tenant) {
        return ['Notices', 'Help Desk', 'Visitors', 'Amenities'].includes(activePage) ? activePage : 'Notices';
    }

    if (role === UserRole.Resident) {
        const forbidden = ['Billing', 'BulkOperations', 'CommunitySetup'];
        return forbidden.includes(activePage) ? 'Dashboard' : activePage;
    }

    if (role === UserRole.Admin) {
        return activePage === 'Billing' ? 'Dashboard' : activePage;
    }

    return activePage;
  }, [user, activePage]);

  // If the memoized logic determines we should be elsewhere, sync the state immediately
  useEffect(() => {
      if (user && resolvedPage !== activePage) {
          setActivePage(resolvedPage);
      }
  }, [resolvedPage, activePage, user]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme); // Optimistic UI update
    
    if (user) {
        try {
            await updateTheme(user.id, newTheme);
            await refreshUser();
        } catch (e) {
            console.error("Failed to save theme preference", e);
        }
    }
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

  // Render Section
  return (
    <Layout activePage={activePage} setActivePage={setActivePage} theme={theme} toggleTheme={toggleTheme}>
      {activePage === 'Dashboard' && <Dashboard navigateToPage={navigateToPage} />}
      {activePage === 'Notices' && <NoticeBoard />}
      {activePage === 'Help Desk' && <HelpDesk />}
      {activePage === 'Visitors' && <Visitors />}
      {activePage === 'Amenities' && <Amenities />}
      {activePage === 'Directory' && <Directory />}
      {activePage === 'Maintenance' && <Maintenance initialFilter={pageParams?.filter} />}
      {activePage === 'Expenses' && <Expenses />}
      {activePage === 'BulkOperations' && <BulkOperations />}
      {activePage === 'CommunitySetup' && <CommunitySetup onComplete={() => setActivePage('Dashboard')} />}
      {activePage === 'Billing' && <Billing />}
    </Layout>
  );
}

export default App;
