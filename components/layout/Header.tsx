
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
        <div className="flex items-center min-w-0">
            {/* Brand Section */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <Logo className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--accent)] flex-shrink-0" />
                <div className="flex flex-col justify-center">
                    <h1 className="text-2xl sm:text-3xl font-brand font-bold text-brand-500 tracking-wide leading-none">Elevate</h1>
                    <span className="text-[9px] sm:text-[10px] text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] font-medium uppercase tracking-wide leading-tight whitespace-nowrap">
                        Community Living, Elevated
                    </span>
                    
                    {/* Mobile & Tablet Community Name Display - Stacked */}
                    {user?.communityName && (
                        <span className="lg:hidden text-[10px] font-bold text-[var(--text-light)] dark:text-[var(--text-dark)] opacity-90 mt-0.5 leading-tight truncate max-w-[200px] sm:max-w-[300px]">
                            {user.communityName}
                        </span>
                    )}
                </div>
            </div>

            {/* Desktop Community Context Section (Divider + Name) - Hidden on Tablets */}
            {user?.communityName && (
                <div className="hidden lg:flex items-center ml-4 pl-4 lg:ml-6 lg:pl-6 border-l border-[var(--border-light)] dark:border-[var(--border-dark)] h-8 min-w-0">
                    <span className="text-sm font-semibold text-[var(--text-light)] dark:text-[var(--text-dark)] opacity-90 whitespace-nowrap truncate">
                        {user.communityName}
                    </span>
                </div>
            )}
        </div>

        <div className="flex items-center flex-shrink-0 ml-2">
          <button
            onClick={toggleTheme}
            className="mr-2 sm:mr-4 p-2 rounded-lg text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
            aria-label="Toggle theme"
          >
              {theme === 'light' ? <MoonIcon className="w-5 h-5 sm:w-6 sm:h-6" /> : <SunIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
          {user && (
            <>
                <div 
                className="flex items-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-xl transition-colors border border-transparent hover:border-[var(--border-light)] dark:hover:border-[var(--border-dark)]"
                onClick={() => setIsProfileOpen(true)}
                role="button"
                tabIndex={0}
                title={getTooltip()}
                >
                <div className="text-right mr-3 hidden sm:block">
                    <p className="font-semibold text-sm text-[var(--text-light)] dark:text-[var(--text-dark)] leading-tight whitespace-nowrap">{user.name}</p>
                    <div className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] font-medium mt-0.5 whitespace-nowrap">
                        {getUnitDisplay()}
                    </div>
                </div>
                
                {/* Modern Square-Rounded Avatar */}
                <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-xs sm:text-sm font-bold shadow-sm ring-2 ring-transparent group-hover:ring-[var(--accent)] transition-all">
                        {getInitials(user.name)}
                    </div>
                    {/* Status Dot */}
                    <span className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-[var(--card-bg-light)] dark:border-[var(--card-bg-dark)] ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                </div>

                </div>
                <button
                    onClick={logout}
                    className="ml-1 sm:ml-3 p-2 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    aria-label="Logout"
                    title="Sign Out"
                >
                    <LogOutIcon className="w-5 h-5 sm:w-6 sm:h-6" />
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
