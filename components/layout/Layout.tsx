
import React, { ReactNode, useLayoutEffect, useRef } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import type { Page } from '../../types';
import type { Theme } from '../../App';
import { motion } from 'framer-motion';

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

  // Immediate scroll reset on page change without triggering layout shifts
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activePage]);

  return (
    <div className="flex h-[100dvh] w-full bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] transition-colors duration-300 overflow-hidden relative">
      {isPending && (
        <div className="loading-progress" />
      )}
      
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <div className="shrink-0 z-30">
          <Header theme={theme} toggleTheme={toggleTheme} />
        </div>
        
        <main 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] outline-none relative"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Subtle opacity-only transition for content speed */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1, ease: "linear" }}
            className="container mx-auto px-3 sm:px-5 lg:px-6 py-4 md:py-5 pb-28 md:pb-6 max-w-full min-h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
      
      <div className="shrink-0 z-40">
        <BottomNav activePage={activePage} setActivePage={setActivePage} />
      </div>
    </div>
  );
};

export default Layout;
