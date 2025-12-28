
import React, { ReactNode, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  // Decisive fix for "Moving Up" / "Double Load" sensation:
  // Force scroll to top IMMEDIATELY when activePage changes, before the browser paints.
  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activePage]);

  return (
    <div className="flex h-[100dvh] w-full bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] transition-colors duration-300 overflow-hidden relative">
      {/* Global Transition Progress Bar */}
      {isPending && <div className="loading-progress" />}
      
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header theme={theme} toggleTheme={toggleTheme} />
        
        <main 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] scroll-smooth outline-none relative"
        >
          {/* 
              AnimatePresence prevents the "jump" by keeping the UI state stable.
              The min-h-full on the motion.div prevents the layout collapse 
              that causes the fixed elements to shift.
          */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="container mx-auto px-3 sm:px-5 lg:px-6 py-4 md:py-5 pb-28 md:pb-6 max-w-full min-h-full overflow-x-hidden"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      
      <BottomNav activePage={activePage} setActivePage={setActivePage} />
    </div>
  );
};

export default Layout;
