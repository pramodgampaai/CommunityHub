
import React from 'react';
import { HomeIcon, BellIcon, ShieldCheckIcon, UsersIcon, SparklesIcon, UserGroupIcon, CurrencyRupeeIcon } from '../icons';
import type { Page } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';

interface SidebarProps {
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
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (user?.role === UserRole.HelpdeskAgent) {
      return ['Notices', 'Help Desk'].includes(item.name);
    }
    if (user?.role === UserRole.Helpdesk) {
      // Helpdesk Admin needs Directory to manage agents
      return ['Notices', 'Help Desk', 'Directory', 'Maintenance'].includes(item.name);
    }
    return true;
  });

  return (
    <aside className="hidden md:flex w-64 flex-col bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] border-r border-[var(--border-light)] dark:border-[var(--border-dark)]">
       <div className="h-20 flex items-center justify-center">
         {/* The title is in the Header component */}
      </div>
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {filteredNavItems.map((item) => (
            <li key={item.name}>
              <button
                onClick={() => setActivePage(item.name)}
                className={`w-full flex items-center p-3 rounded-full transition-all duration-200 group ${
                  activePage === item.name
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-googleBlue-600 dark:text-blue-300'
                    : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              >
                <item.icon className="w-6 h-6" />
                <span className={`ml-4 font-medium ${activePage === item.name ? 'text-googleBlue-600 dark:text-blue-200' : ''}`}>{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
