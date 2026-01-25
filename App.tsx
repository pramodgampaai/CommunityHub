
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import NoticeBoard from './pages/NoticeBoard';
import HelpDesk from './pages/HelpDesk';
import Visitors from './pages/Visitors';
import Amenities from './pages/Amenities';
import Assets from './pages/Assets';
import AdminPanel from './pages/AdminPanel';
import Directory from './pages/Directory';
import Maintenance from './pages/Maintenance';
import Expenses from './pages/Expenses';
import CommunitySetup from './pages/CommunitySetup';
import Billing from './pages/Billing';
import BulkOperations from './pages/BulkOperations';
import ResetPassword from './pages/ResetPassword';
import Marketplace from './pages/Marketplace';
import type { Page } from './types';
import { UserRole } from './types';
import Spinner from './components/ui/Spinner';
import Card from './components/ui/Card';
import { isSupabaseConfigured } from './services/supabase';
import { updateTheme } from './services/api';

export type Theme = 'light' | 'dark';

function App() {
  const { user, loading, updateUser } = useAuth();
  
  const isResetFlow = window.location.pathname === '/reset-password';

  const [requestedPage, setRequestedPage] = useState<Page>('Dashboard');
  const [pageParams, setPageParams] = useState<any>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [isNavigating, setIsNavigating] = useState(false);

  const navigateToPage = useCallback((page: Page, params?: any) => {
      setIsNavigating(true);
      setPageParams(params || null);
      setRequestedPage(page);
      // Brief delay to allow top bar animation to be seen
      setTimeout(() => setIsNavigating(false), 300);
  }, []);

  const handleManualPageChange = useCallback((page: Page) => {
      setIsNavigating(true);
      setPageParams(null);
      setRequestedPage(page);
      setTimeout(() => setIsNavigating(false), 300);
  }, []);

  const activePage = useMemo((): Page => {
    if (isResetFlow) return 'Dashboard'; 
    if (!user) return requestedPage;

    const hasUnits = user.units && user.units.length > 0;
    const isSetupRequiredRole = user.role === UserRole.Admin || user.role === UserRole.Resident;
    
    if (isSetupRequiredRole && !hasUnits) return 'CommunitySetup';

    const role = user.role;
    const requested = requestedPage;

    if (role === UserRole.SuperAdmin) {
        // SuperAdmin is strictly restricted to global panels
        return ['AdminPanel', 'Billing'].includes(requested) ? requested : 'AdminPanel';
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
        return ['Notices', 'Help Desk', 'Visitors', 'Amenities', 'Assets', 'Marketplace'].includes(requested) ? requested : 'Notices';
    }
    if (role === UserRole.Resident) {
        const forbidden: Page[] = ['Billing', 'BulkOperations', 'CommunitySetup', 'AdminPanel'];
        return forbidden.includes(requested) ? 'Dashboard' : requested;
    }
    if (role === UserRole.Admin) {
        const forbidden: Page[] = ['Billing', 'AdminPanel'];
        return forbidden.includes(requested) ? 'Dashboard' : requested;
    }

    return requested;
  }, [user?.role, user?.units?.length, requestedPage, isResetFlow]);

  useEffect(() => {
    if (!user) {
        if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) setTheme('dark');
        else setTheme('light');
    } else if (user.theme) {
        setTheme(user.theme);
    }
  }, [user?.id, user?.theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme); 
    if (user) {
        updateUser({ theme: newTheme });
        updateTheme(user.id, newTheme).catch(e => console.error("Theme sync failed:", e));
    }
  }, [theme, user, updateUser]);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] p-4 text-center">
        <Card className="p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
          <p className="text-slate-500">Database connection parameters are missing.</p>
        </Card>
      </div>
    );
  }

  if (isResetFlow) {
    return <ResetPassword />;
  }

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-[var(--bg-light)] dark:bg-[var(--bg-dark)]">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout 
        activePage={activePage} 
        setActivePage={handleManualPageChange} 
        theme={theme} 
        toggleTheme={toggleTheme}
        isPending={isNavigating}
    >
      <div className="gpu-accelerated min-h-full">
          {activePage === 'Dashboard' && <Dashboard navigateToPage={navigateToPage} />}
          {activePage === 'AdminPanel' && <AdminPanel navigateToPage={navigateToPage} />}
          {activePage === 'Notices' && <NoticeBoard />}
          {activePage === 'Help Desk' && <HelpDesk />}
          {activePage === 'Visitors' && <Visitors />}
          {activePage === 'Amenities' && <Amenities />}
          {activePage === 'Assets' && <Assets />}
          {activePage === 'Directory' && <Directory />}
          {activePage === 'Maintenance' && <Maintenance initialFilter={pageParams?.filter} />}
          {activePage === 'Expenses' && <Expenses />}
          {activePage === 'BulkOperations' && <BulkOperations />}
          {activePage === 'CommunitySetup' && <CommunitySetup onComplete={() => setRequestedPage('Dashboard')} />}
          {activePage === 'Billing' && <Billing />}
          {activePage === 'Marketplace' && <Marketplace />}
      </div>
    </Layout>
  );
}

export default App;
