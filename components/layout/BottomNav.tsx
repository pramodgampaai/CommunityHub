import React from 'react';
import { HomeIcon, BellIcon, ShieldCheckIcon, UsersIcon, SparklesIcon } from '../icons';
import type { Page } from '../../types';

interface BottomNavProps {
    activePage: Page;
    setActivePage: (page: Page) => void;
}

const navItems: { name: Page; icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
    { name: 'Dashboard', icon: HomeIcon },
    { name: 'Notices', icon: BellIcon },
    { name: 'Help Desk', icon: ShieldCheckIcon },
    { name: 'Visitors', icon: UsersIcon },
    { name: 'Amenities', icon: SparklesIcon },
];

const BottomNav: React.FC<BottomNavProps> = ({ activePage, setActivePage }) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] border-t border-[var(--border-light)] dark:border-[var(--border-dark)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <button
            key={item.name}
            onClick={() => setActivePage(item.name)}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${
              activePage === item.name ? 'text-[var(--accent)]' : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]'
            }`}
          >
            <div className={`flex items-center justify-center rounded-full px-5 py-1 ${activePage === item.name ? 'bg-blue-100 dark:bg-blue-500/20' : ''}`}>
                <item.icon className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium mt-1">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;