import React, { ReactNode } from 'react';
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
}

const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage, theme, toggleTheme }) => {
  return (
    <div className="flex h-screen bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] text-[var(--text-light)] dark:text-[var(--text-dark)]">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header theme={theme} toggleTheme={toggleTheme} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[var(--bg-light)] dark:bg-[var(--bg-dark)] pb-24 md:pb-0">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
      <BottomNav activePage={activePage} setActivePage={setActivePage} />
    </div>
  );
};

export default Layout;