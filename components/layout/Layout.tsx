
import React, { ReactNode, useLayoutEffect, useRef } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import type { Page } from '../../types';
import type { Theme } from '../../App';
import { motion, AnimatePresence } from 'framer-motion';

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

  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activePage]);

  return (
    <div className="flex h-[100dvh] w-full bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)] transition-colors duration-300 overflow-hidden relative">
      {/* Non-intrusive progress bar */}
      <AnimatePresence>
        {isPending && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="loading-progress" 
          />
        )}
      </AnimatePresence>
      
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <div className="shrink-0 z-30">
          <Header theme={theme} toggleTheme={toggleTheme} />
        </div>
        
        <main 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] outline-none relative gpu-accelerated"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* 
              STABILITY FIX: 
              Wrap children in a motion div with a key to handle smooth cross-fading.
              This prevents the "instant jump" by slightly slowing the transition
              and ensuring the GPU handles the frame swap.
          */}
          <motion.div 
            key={activePage}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
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
