

import React from 'react';
import { HomeIcon, BellIcon, ShieldCheckIcon, UsersIcon, SparklesIcon, UserGroupIcon, CurrencyRupeeIcon, BanknotesIcon } from '../icons';
import type { Page } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';

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
    { name: 'Directory', icon: UserGroupIcon },
    { name: 'Maintenance', icon: CurrencyRupeeIcon },
    { name: 'Expenses', icon: BanknotesIcon },
];

const BottomNav: React.FC<BottomNavProps> = ({ activePage, setActivePage }) => {
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (user?.role === UserRole.HelpdeskAgent) {
      return ['Notices', 'Help Desk'].includes(item.name);
    }
    if (user?.role === UserRole.HelpdeskAdmin) {
      return ['Notices', 'Help Desk', 'Directory'].includes(item.name);
    }
    if (user?.role === UserRole.SecurityAdmin || user?.role === UserRole.Security) {
        return ['Notices', 'Visitors', 'Directory'].includes(item.name);
    }
    if (user?.role === UserRole.Admin) {
       return true;
    }
    if (item.name === 'Expenses') return false;
    
    return true;
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] border-t border-[var(--border-light)] dark:border-[var(--border-dark)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-20 overflow-x-auto no-scrollbar">
      <div className={`flex justify-around items-center h-16 min-w-max px-2 ${filteredNavItems.length < 4 ? 'justify-evenly' : ''}`}>
        {filteredNavItems.map((item) => (
          <button
            key={item.name}
            onClick={() => setActivePage(item.name)}
            aria-label={`Navigate to ${item.name}`}
            aria-current={activePage === item.name ? 'page' : undefined}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors duration-200 group focus:outline-none ${
              activePage === item.name ? 'text-[var(--accent)]' : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]'
            }`}
          >
            <div className={`flex items-center justify-center rounded-full px-3 py-1 transition-colors duration-200 ${
                activePage === item.name 
                    ? 'bg-teal-100 dark:bg-teal-500/20' 
                    : 'group-hover:bg-gray-100 dark:group-hover:bg-white/5'
            }`}>
                <item.icon className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-medium mt-1 truncate w-full text-center">{item.name}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;