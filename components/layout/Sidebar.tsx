
import React from 'react';
import { HomeIcon, BellIcon, ShieldCheckIcon, UsersIcon, SparklesIcon, UserGroupIcon, CurrencyRupeeIcon, BanknotesIcon, CalculatorIcon, Cog6ToothIcon, ClipboardDocumentListIcon, Squares2X2Icon } from '../icons';
import type { Page } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

const navItems: { name: Page; icon: React.FC<React.SVGProps<SVGSVGElement>>; label: string }[] = [
  { name: 'Dashboard', icon: HomeIcon, label: 'Home' },
  { name: 'AdminPanel', icon: Squares2X2Icon, label: 'Communities' },
  { name: 'Notices', icon: BellIcon, label: 'Notice Board' },
  { name: 'Help Desk', icon: ShieldCheckIcon, label: 'Help Desk' },
  { name: 'Visitors', icon: UsersIcon, label: 'Visitors' },
  { name: 'Amenities', icon: SparklesIcon, label: 'Amenities' },
  { name: 'Directory', icon: UserGroupIcon, label: 'Directory' },
  { name: 'Maintenance', icon: CurrencyRupeeIcon, label: 'Maintenance' },
  { name: 'Expenses', icon: BanknotesIcon, label: 'Expenses' },
  { name: 'BulkOperations', icon: ClipboardDocumentListIcon, label: 'Bulk Ops' },
  { name: 'Billing', icon: CalculatorIcon, label: 'Billing' },
  { name: 'CommunitySetup', icon: Cog6ToothIcon, label: 'Property Config' },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (user?.role === UserRole.SuperAdmin) return ['AdminPanel', 'Billing'].includes(item.name);
    if (user?.role === UserRole.HelpdeskAgent) return ['Notices', 'Help Desk'].includes(item.name);
    if (user?.role === UserRole.HelpdeskAdmin) return ['Notices', 'Help Desk', 'Directory'].includes(item.name);
    
    // Explicit split for Security roles
    if (user?.role === UserRole.SecurityAdmin) return ['Notices', 'Visitors', 'Directory'].includes(item.name);
    if (user?.role === UserRole.Security) return ['Notices', 'Visitors'].includes(item.name);
    
    // Tenant Role
    if (user?.role === UserRole.Tenant) return ['Notices', 'Help Desk', 'Visitors', 'Amenities'].includes(item.name);
    
    if (user?.role === UserRole.Admin) return item.name !== 'Billing';
    return item.name !== 'Billing' && item.name !== 'CommunitySetup' && item.name !== 'BulkOperations' && item.name !== 'AdminPanel';
  });

  return (
    <aside className="hidden md:flex w-72 flex-col bg-[var(--bg-light)]/40 dark:bg-[var(--bg-dark)]/60 backdrop-blur-xl border-r border-[var(--border-light)] dark:border-[var(--border-dark)] z-20">
       <div className="h-20" /> {/* Spacer for Header */}
      
      <div className="p-6">
          <p className="text-[10px] font-black text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] uppercase tracking-[0.2em] mb-4 ml-4 opacity-70">
              Main Menu
          </p>
          <nav className="space-y-1">
            {filteredNavItems.map((item) => (
              <button
                key={item.name}
                onClick={() => setActivePage(item.name)}
                className={`w-full flex items-center p-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                  activePage === item.name
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                    : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-white dark:hover:bg-zinc-800 hover:text-[var(--text-light)] dark:hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 z-10 transition-transform group-hover:scale-110 ${activePage === item.name ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
                <span className={`ml-4 font-bold text-sm z-10 tracking-tight`}>
                    {item.label}
                </span>
                
                {/* Active Indicator Bar */}
                {activePage === item.name && (
                    <div className="absolute right-0 top-1/4 bottom-1/4 w-1 bg-white rounded-l-full" />
                )}
              </button>
            ))}
          </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
