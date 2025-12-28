
import React, { ReactNode, useLayoutEffect, useRef } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import type { Page } from '../../types';
import type { Theme } from '../../App';

interface LayoutProps {
  children: ReactNode;
  activePage: Page;
  setActivePage: (page: Page) => void;
  theme: Theme;
  toggleTheme: () => void;
  isPending?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage, theme, toggleTheme, isPending }) => {
  const scrollContainerRef = useRef<HTMLElement>(null);

  // Force scroll to top immediately when activePage changes.
  // We use useLayoutEffect to ensure this happens before the browser paints.
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activePage]);

  return (
    <div className="flex h-[100dvh] w-full bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] transition-colors duration-300 overflow-hidden relative">
      {/* Global Transition Progress Bar - Non-blocking feedback */}
      {isPending && <div className="loading-progress" />}
      
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <div className="shrink-0">
          <Header theme={theme} toggleTheme={toggleTheme} />
        </div>
        
        <main 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] outline-none relative"
        >
          {/* 
              STABILITY FIX: 
              We removed AnimatePresence and the 'key' attribute here.
              This prevents the 'Layout Collapse' that caused the 'move up' shift.
              It also ensures that if a page re-renders, it doesn't unmount/remount,
              keeping the Dashboard counter stable.
          */}
          <div className="container mx-auto px-3 sm:px-5 lg:px-6 py-4 md:py-5 pb-28 md:pb-6 max-w-full min-h-full overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
      
      <div className="shrink-0">
        <BottomNav activePage={activePage} setActivePage={setActivePage} />
      </div>
    </div>
  );
};

export default Layout;
