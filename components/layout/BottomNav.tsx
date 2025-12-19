import React from 'react';
import { motion } from 'framer-motion';
import { HomeIcon, BellIcon, ShieldCheckIcon, UsersIcon, SparklesIcon, UserGroupIcon, CurrencyRupeeIcon, BanknotesIcon, CalculatorIcon, Cog6ToothIcon } from '../icons';
import type { Page } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';

interface BottomNavProps {
    activePage: Page;
    setActivePage: (page: Page) => void;
}

const navItems: { name: Page; icon: React.FC<React.SVGProps<SVGSVGElement>>; label: string }[] = [
    { name: 'Dashboard', icon: HomeIcon, label: 'Home' },
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
    if (user?.role === UserRole.SecurityAdmin || user?.role === UserRole.Security) return ['Notices', 'Visitors', 'Directory'].includes(item.name);
    if (user?.role === UserRole.Admin) return item.name !== 'Billing';
    return item.name !== 'Billing' && item.name !== 'CommunitySetup';
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-light)]/90 dark:bg-[var(--bg-dark)]/90 backdrop-blur-2xl border-t border-[var(--border-light)] dark:border-[var(--border-dark)] z-40 px-4 pb-safe">
      <div className="flex justify-around items-center h-20 max-w-lg mx-auto relative">
        {filteredNavItems.map((item) => {
          const isActive = activePage === item.name;
          return (
            <button
              key={item.name}
              onClick={() => setActivePage(item.name)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 relative ${
                isActive ? 'text-brand-500' : 'text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]'
              }`}
            >
              <div className={`p-2 transition-all duration-300 ${isActive ? 'scale-110' : 'scale-100 opacity-60'}`}>
                  <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
              </div>
              <span className={`text-[10px] font-bold mt-1 tracking-tight ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                  {item.label}
              </span>
              
              {isActive && (
                <motion.div 
                  layoutId="bottomNavIndicator"
                  className="absolute bottom-1 w-1 h-1 bg-brand-500 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;