
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOutIcon, MoonIcon, SunIcon } from '../icons';
import { Theme } from '../../App';
import ProfileModal from '../ProfileModal';
import Logo from '../ui/Logo';

interface HeaderProps {
    theme: Theme;
    toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme }) => {
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Helper to format unit display in header
  const getUnitDisplay = () => {
      if (!user) return '';
      
      if (user.units && user.units.length > 0) {
          const primary = user.units[0];
          const primaryStr = `Flat: ${primary.block ? primary.block + '-' : ''}${primary.flatNumber}`;
          
          if (user.units.length > 1) {
              return (
                  <span className="flex items-center gap-1">
                      {primaryStr}
                      <span className="bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200 text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                          +{user.units.length - 1}
                      </span>
                  </span>
              );
          }
          return primaryStr;
      }
      
      // Fallback for staff or legacy
      return user.flatNumber ? (user.role === 'Resident' ? `Flat: ${user.flatNumber}` : `${user.flatNumber}`) : '';
  };

  const getTooltip = () => {
      if (!user?.units || user.units.length <= 1) return undefined;
      return user.units.map(u => `${u.block ? u.block + '-' : ''}${u.flatNumber}`).join(', ');
  }

  // Helper to get initials
  const getInitials = (name: string) => {
      return name
          .split(' ')
          .map(part => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();
  };

  return (
    <>
      <header className="flex justify-between items-center p-4 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] border-b border-[var(--border-light)] dark:border-[var(--border-dark)] z-10 sticky top-0">
        <div className="flex items-center gap-3">
            <Logo className="w-10 h-10 text-[var(--accent)]" />
            <div className="flex flex-col">
                <h1 className="text-3xl font-brand font-bold text-brand-500 tracking-wide leading-none">Elevate</h1>
                <span className="text-[10px] text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] font-medium uppercase tracking-wide hidden sm:block">Community Living, Elevated</span>
            </div>
        </div>
        <div className="flex items-center">
          <button
            onClick={toggleTheme}
            className="mr-4 p-2 rounded-lg text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
            aria-label="Toggle theme"
          >
              {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
          </button>
          {user && (
            <>
                <div 
                className="flex items-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-xl transition-colors border border-transparent hover:border-[var(--border-light)] dark:border-[var(--border-dark)]"
                onClick={() => setIsProfileOpen(true)}
                role="button"
                tabIndex={0}
                title={getTooltip()}
                >
                <div className="text-right mr-3 hidden sm:block">
                    <p className="font-semibold text-sm text-[var(--text-light)] dark:text-[var(--text-dark)] leading-tight">{user.name}</p>
                    <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] font-medium mt-0.5">
                        {getUnitDisplay()}
                    </div>
                </div>
                
                {/* Modern Square-Rounded Avatar */}
                <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-transparent group-hover:ring-[var(--accent)] transition-all">
                        {getInitials(user.name)}
                    </div>
                    {/* Status Dot */}
                    <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[var(--card-bg-light)] dark:border-[var(--card-bg-dark)] ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                </div>

                </div>
                <button
                    onClick={logout}
                    className="ml-3 p-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    aria-label="Logout"
                    title="Sign Out"
                >
                    <LogOutIcon className="w-6 h-6" />
                </button>
            </>
          )}
        </div>
      </header>
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
};

export default Header;
