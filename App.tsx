
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
// Fix: Import missing Card component
import Card from './components/ui/Card';
import { isSupabaseConfigured } from './services/supabase';
import { updateTheme } from './services/api';

export type Theme = 'light' | 'dark';

function App() {
  const { user, loading, refreshUser } = useAuth();
  const [isPending, startTransition] = useTransition();
  
  // Single source of truth for the active page
  const [activePage, setActivePage] = useState<Page>(() => {
      const savedPage = localStorage.getItem('nilayam_last_page');
      return (savedPage as Page) || 'Dashboard';
  });
  
  const [pageParams, setPageParams] = useState<any>(null);
  const [theme, setTheme] = useState<Theme>('light');

  // Helper to validate if a user can access a specific page
  const getAuthorizedPage = useCallback((requested: Page, currentUser: any): Page => {
    if (!currentUser) return requested;

    const hasUnits = currentUser.units && currentUser.units.length > 0;
    const isSetupRequiredRole = currentUser.role === UserRole.Admin || currentUser.role === UserRole.Resident;
    
    if (isSetupRequiredRole && !hasUnits) {
        return 'CommunitySetup';
    }

    const role = currentUser.role;
    
    if (role === UserRole.SuperAdmin) {
        return ['Dashboard', 'Billing'].includes(requested) ? requested : 'Dashboard';
    }

    if (role === UserRole.HelpdeskAgent) {
        return ['Notices', 'Help Desk'].includes(requested) ? requested : 'Help Desk';
    }

    if (role === UserRole.HelpdeskAdmin) {
        return ['Notices', 'Help Desk', 'Directory'].includes(requested) ? requested : 'Help Desk';
    }

    if (role === UserRole.SecurityAdmin) {
        return ['Notices', 'Visitors', 'Directory'].includes(requested) ? requested : 'Visitors';
    }

    if (role === UserRole.Security) {
        return ['Notices', 'Visitors'].includes(requested) ? requested : 'Visitors';
    }

    if (role === UserRole.Tenant) {
        return ['Notices', 'Help Desk', 'Visitors', 'Amenities'].includes(requested) ? requested : 'Notices';
    }

    if (role === UserRole.Resident) {
        const forbidden = ['Billing', 'BulkOperations', 'CommunitySetup'];
        return forbidden.includes(requested) ? 'Dashboard' : requested;
    }

    if (role === UserRole.Admin) {
        return requested === 'Billing' ? 'Dashboard' : requested;
    }

    return requested;
  }, []);

  // Sync activePage with authorization rules whenever user state changes
  useEffect(() => {
      if (user) {
          const authorized = getAuthorizedPage(activePage, user);
          if (authorized !== activePage) {
              setActivePage(authorized);
          }
      }
  }, [user, getAuthorizedPage]);

  // Persist valid page
  useEffect(() => {
      localStorage.setItem('nilayam_last_page', activePage);
  }, [activePage]);

  // Theme logic
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
        } catch (e) { console.error(e); }
    }
  };

  const navigateToPage = useCallback((page: Page, params?: any) => {
      startTransition(() => {
          const authorized = getAuthorizedPage(page, user);
          setPageParams(params || null);
          setActivePage(authorized);
      });
  }, [user, getAuthorizedPage]);

  const handleManualPageChange = useCallback((page: Page) => {
      startTransition(() => {
          const authorized = getAuthorizedPage(page, user);
          setPageParams(null);
          setActivePage(authorized);
      });
  }, [user, getAuthorizedPage]);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] p-4 text-center">
        <Card className="p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Config Required</h1>
          <p className="text-slate-500">Connect your Supabase instance to proceed.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Render Strategy: Direct switch without intermediate unmounting wrappers
  return (
    <Layout 
        activePage={activePage} 
        setActivePage={handleManualPageChange} 
        theme={theme} 
        toggleTheme={toggleTheme}
        isPending={isPending}
    >
      {activePage === 'Dashboard' && <Dashboard navigateToPage={navigateToPage} />}
      {activePage === 'Notices' && <NoticeBoard />}
      {activePage === 'Help Desk' && <HelpDesk />}
      {activePage === 'Visitors' && <Visitors />}
      {activePage === 'Amenities' && <Amenities />}
      {activePage === 'Directory' && <Directory />}
      {activePage === 'Maintenance' && <Maintenance initialFilter={pageParams?.filter} />}
      {activePage === 'Expenses' && <Expenses />}
      {activePage === 'BulkOperations' && <BulkOperations />}
      {activePage === 'CommunitySetup' && <CommunitySetup onComplete={() => navigateToPage('Dashboard')} />}
      {activePage === 'Billing' && <Billing />}
    </Layout>
  );
}

export default App;
