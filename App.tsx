
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
import CommunitySetup from './pages/CommunitySetup';
import type { Page } from './types';
import { UserRole } from './types';
import Spinner from './components/ui/Spinner';
import { isSupabaseConfigured } from './services/supabase';
import { getCommunity, updateTheme } from './services/api';

export type Theme = 'light' | 'dark';

function App() {
  const { user, loading, refreshUser } = useAuth();
  
  // Initialize activePage from localStorage if available to persist across refreshes
  const [activePage, setActivePage] = useState<Page>(() => {
      const savedPage = localStorage.getItem('elevate_last_page');
      return (savedPage as Page) || 'Dashboard';
  });
  
  const [pageParams, setPageParams] = useState<any>(null);
  
  // Persist the active page to localStorage whenever it changes
  useEffect(() => {
      if (activePage) {
          localStorage.setItem('elevate_last_page', activePage);
      }
  }, [activePage]);
  
  // Initialize theme with a default 'light'. 
  // We'll update it based on system pref (if no user) or user pref (if user) in useEffects.
  const [theme, setTheme] = useState<Theme>('light');

  // Initial Theme Setup: Check system preference if no user preference is available yet.
  useEffect(() => {
    if (!user) {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    }
  }, []);

  // Sync theme with user preference when user loads
  useEffect(() => {
      if (user?.theme) {
          setTheme(user.theme);
      }
  }, [user]);

  // Apply theme to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Enforce Role-Based Page Access and Community Setup Logic
  useEffect(() => {
    const checkAccess = async () => {
        if (!user) return;

        // 1. Admin Landscape & Unit Setup Check
        if (user.role === UserRole.Admin && user.communityId) {
            // Avoid infinite loop by only checking if not already on setup page
            if (activePage !== 'CommunitySetup') {
                try {
                    // Check Landscape
                    const community = await getCommunity(user.communityId);
                    const hasBlocks = community.blocks && community.blocks.length > 0;
                    
                    // Check User Units (useAuth provides updated units on profile fetch)
                    const hasUnits = user.units && user.units.length > 0;

                    if (!hasBlocks || !hasUnits) {
                        setActivePage('CommunitySetup');
                        return; // Stop further checks
                    }
                } catch (e) {
                    console.error("Failed to check community setup status", e);
                }
            }
        }

        // 2. Standard Role Redirects
        if (user.role === UserRole.HelpdeskAgent) {
            const allowed = ['Notices', 'Help Desk'];
            if (!allowed.includes(activePage)) setActivePage('Help Desk');
        } else if (user.role === UserRole.HelpdeskAdmin) {
            const allowed = ['Notices', 'Help Desk', 'Directory'];
            if (!allowed.includes(activePage)) setActivePage('Help Desk');
        } else if (user.role === UserRole.SecurityAdmin || user.role === UserRole.Security) {
            const allowed = ['Notices', 'Visitors', 'Directory'];
            if (!allowed.includes(activePage)) setActivePage('Visitors');
        } else if (user.role !== UserRole.Admin && activePage === 'Expenses') {
            setActivePage('Dashboard');
        }
    };

    checkAccess();
  }, [user, activePage]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme); // Optimistic UI update
    
    if (user) {
        try {
            await updateTheme(user.id, newTheme);
            // Refresh user to ensure context has latest theme if needed elsewhere
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

  // Role-based routing
  if (user.role === UserRole.SuperAdmin) {
    return <AdminPanel theme={theme} toggleTheme={toggleTheme} />;
  }
  
  // If we are in setup mode, we force that page and hide navigation (via Layout logic)
  if (activePage === 'CommunitySetup') {
      return (
          <Layout activePage={activePage} setActivePage={setActivePage} theme={theme} toggleTheme={toggleTheme}>
              <CommunitySetup onComplete={() => setActivePage('Dashboard')} />
          </Layout>
      );
  }

  // Define allowed pages per role for rendering check
  let allowedPages: Page[] = ['Dashboard', 'Notices', 'Help Desk', 'Visitors', 'Amenities', 'Directory', 'Maintenance'];
  
  if (user.role === UserRole.HelpdeskAgent) {
      allowedPages = ['Notices', 'Help Desk'];
  } else if (user.role === UserRole.HelpdeskAdmin) {
      allowedPages = ['Notices', 'Help Desk', 'Directory'];
  } else if (user.role === UserRole.SecurityAdmin || user.role === UserRole.Security) {
      allowedPages = ['Notices', 'Visitors', 'Directory'];
  } else if (user.role === UserRole.Admin) {
      allowedPages.push('Expenses');
  }

  // If the user is on a restricted page, don't render content, just wait for useEffect to redirect
  if (!allowedPages.includes(activePage)) {
      return (
        <Layout activePage={activePage} setActivePage={setActivePage} theme={theme} toggleTheme={toggleTheme}>
            <div className="flex items-center justify-center h-full">
                <Spinner />
            </div>
        </Layout>
      );
  }

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
    </Layout>
  );
}

export default App;
