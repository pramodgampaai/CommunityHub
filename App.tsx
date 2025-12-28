
import React, { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
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
  const [isPending, startTransition] = useTransition();
  
  const [requestedPage, setRequestedPage] = useState<Page>(() => {
      const savedPage = localStorage.getItem('nilayam_last_page');
      return (savedPage as Page) || 'Dashboard';
  });
  
  const [pageParams, setPageParams] = useState<any>(null);
  const [theme, setTheme] = useState<Theme>('light');

  const currentPage = useMemo((): Page => {
    if (!user) return requestedPage;

    const hasUnits = user.units && user.units.length > 0;
    const isSetupRequiredRole = user.role === UserRole.Admin || user.role === UserRole.Resident;
    
    if (isSetupRequiredRole && !hasUnits) {
        return 'CommunitySetup';
    }

    const role = user.role;
    
    if (role === UserRole.SuperAdmin) {
        return ['Dashboard', 'Billing'].includes(requestedPage) ? requestedPage : 'Dashboard';
    }

    if (role === UserRole.HelpdeskAgent) {
        return ['Notices', 'Help Desk'].includes(requestedPage) ? requestedPage : 'Help Desk';
    }

    if (role === UserRole.HelpdeskAdmin) {
        return ['Notices', 'Help Desk', 'Directory'].includes(requestedPage) ? requestedPage : 'Help Desk';
    }

    if (role === UserRole.SecurityAdmin) {
        return ['Notices', 'Visitors', 'Directory'].includes(requestedPage) ? requestedPage : 'Visitors';
    }

    if (role === UserRole.Security) {
        return ['Notices', 'Visitors'].includes(requestedPage) ? requestedPage : 'Visitors';
    }

    if (role === UserRole.Tenant) {
        return ['Notices', 'Help Desk', 'Visitors', 'Amenities'].includes(requestedPage) ? requestedPage : 'Notices';
    }

    if (role === UserRole.Resident) {
        const forbidden = ['Billing', 'BulkOperations', 'CommunitySetup'];
        return forbidden.includes(requestedPage) ? 'Dashboard' : requestedPage;
    }

    if (role === UserRole.Admin) {
        return requestedPage === 'Billing' ? 'Dashboard' : requestedPage;
    }

    return requestedPage;
  }, [user, requestedPage]);

  useEffect(() => {
      localStorage.setItem('nilayam_last_page', currentPage);
  }, [currentPage]);

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

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme); 
    
    if (user) {
        try {
            await updateTheme(user.id, newTheme);
            await refreshUser();
        } catch (e) {
            console.error("Failed to save theme preference", e);
        }
    }
  };

  const navigateToPage = useCallback((page: Page, params?: any) => {
      startTransition(() => {
          setPageParams(params || null);
          setRequestedPage(page);
      });
  }, []);

  const handleManualPageChange = useCallback((page: Page) => {
      startTransition(() => {
          setPageParams(null); // Clear params on manual nav
          setRequestedPage(page);
      });
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] p-4">
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

  return (
    <Layout 
        activePage={currentPage} 
        setActivePage={handleManualPageChange} 
        theme={theme} 
        toggleTheme={toggleTheme}
        isPending={isPending}
    >
      {currentPage === 'Dashboard' && <Dashboard navigateToPage={navigateToPage} />}
      {currentPage === 'Notices' && <NoticeBoard />}
      {currentPage === 'Help Desk' && <HelpDesk />}
      {currentPage === 'Visitors' && <Visitors />}
      {currentPage === 'Amenities' && <Amenities />}
      {currentPage === 'Directory' && <Directory />}
      {currentPage === 'Maintenance' && <Maintenance initialFilter={pageParams?.filter} />}
      {currentPage === 'Expenses' && <Expenses />}
      {currentPage === 'BulkOperations' && <BulkOperations />}
      {currentPage === 'CommunitySetup' && <CommunitySetup onComplete={() => navigateToPage('Dashboard')} />}
      {currentPage === 'Billing' && <Billing />}
    </Layout>
  );
}

export default App;
