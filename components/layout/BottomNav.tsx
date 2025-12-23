import React from 'react';
import { motion } from 'framer-motion';
import { HomeIcon, BellIcon, ShieldCheckIcon, UsersIcon, SparklesIcon, UserGroupIcon, CurrencyRupeeIcon, BanknotesIcon, CalculatorIcon, Cog6ToothIcon, ClipboardDocumentListIcon } from '../icons';
import type { Page } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';

interface BottomNavProps {
    activePage: Page;
    setActivePage: (page: Page) => void;
}

const navItems: { name: Page; icon: React.FC<React.SVGProps<SVGSVGElement>>; label: string }[] = [
    { name: 'Dashboard', icon: HomeIcon, label: 'Home' },
    { name: 'BulkOperations', icon: ClipboardDocumentListIcon, label: 'Bulk Ops' }, // Moved up for priority
    { name: 'Notices', icon: BellIcon, label: 'Notices' },
    { name: 'Help Desk', icon: ShieldCheckIcon, label: 'Help' },
    { name: 'Visitors', icon: UsersIcon, label: 'Visitors' },
    { name: 'Amenities', icon: SparklesIcon, label: 'Facilities' },
    { name: 'Directory', icon: UserGroupIcon, label: 'Members' },
    { name: 'Maintenance', icon: CurrencyRupeeIcon, label: 'Bills' },
    { name: 'Expenses', icon: BanknotesIcon, label: 'Expenses' },
    { name: 'Billing', icon: CalculatorIcon, label: 'Admin' },
    { name: 'CommunitySetup', icon: Cog6ToothIcon, label: 'Config' },
];

const BottomNav: React.FC<BottomNavProps> = ({ activePage, setActivePage }) => {
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (user?.role === UserRole.SuperAdmin) return ['Dashboard', 'Billing'].includes(item.name);
    if (user?.role === UserRole.HelpdeskAgent) return ['Notices', 'Help Desk'].includes(item.name);
    if (user?.role === UserRole.HelpdeskAdmin) return ['Notices', 'Help Desk', 'Directory'].includes(item.name);
    
    // Explicit split for Security roles
    if (user?.role === UserRole.SecurityAdmin) return ['Notices', 'Visitors', 'Directory'].includes(item.name);
    if (user?.role === UserRole.Security) return ['Notices', 'Visitors'].includes(item.name);

    if (user?.role === UserRole.Admin) return item.name !== 'Billing';
    return item.name !== 'Billing' && item.name !== 'CommunitySetup' && item.name !== 'BulkOperations';
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-light)]/90 dark:bg-[var(--bg-dark)]/90 backdrop-blur-2xl border-t border-[var(--border-light)] dark:border-[var(--border-dark)] z-40 px-4 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
      <div className="flex justify-start items-center h-20 max-w-lg mx-auto relative overflow-x-auto no-scrollbar scroll-smooth snap-x">
        {filteredNavItems.map((item) => {
          const isActive = activePage === item.name;
          return (
            <button
              key={item.name}
              onClick={() => setActivePage(item.name)}
              className={`flex flex-col items-center justify-center flex-shrink-0 h-full transition-all duration-200 relative min-w-[76px] snap-center ${
                isActive ? 'text-brand-500' : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]'
              }`}
            >
              <div className={`p-2 transition-all duration-300 ${isActive ? 'scale-110' : 'scale-100 opacity-60'}`}>
                  <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 transition-opacity ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                  {item.label}
              </span>
              
              {isActive && (
                <motion.div 
                  layoutId="bottomNavIndicator"
                  className="absolute bottom-2 w-1.5 h-1.5 bg-brand-500 rounded-full shadow-[0_0_10px_rgba(13,148,136,0.5)]"
                />
              )}
            </button>
          );
        })}
      </div>
      {/* Visual indicator for scrollability */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
          <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
      </div>
    </nav>
  );
};

export default BottomNav;