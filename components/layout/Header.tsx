
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOutIcon, MoonIcon, SunIcon } from '../icons';
import { Theme } from '../../App';
import ProfileModal from '../ProfileModal';

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
                      <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
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

  return (
    <>
      <header className="flex justify-between items-center p-4 bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] border-b border-[var(--border-light)] dark:border-[var(--border-dark)] z-10 sticky top-0">
        <h1 className="text-xl font-bold text-[var(--accent)]">CommunityHub</h1>
        <div className="flex items-center">
          <button
            onClick={toggleTheme}
            className="mr-4 p-2 rounded-full text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
            aria-label="Toggle theme"
          >
              {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
          </button>
          {user && (
            <div 
              className="flex items-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-colors border border-transparent hover:border-[var(--border-light)] dark:hover:border-[var(--border-dark)]"
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
              <div className="relative">
                <img className="w-10 h-10 rounded-full ring-2 ring-offset-2 ring-offset-[var(--card-bg-light)] dark:ring-offset-[var(--card-bg-dark)] ring-[var(--accent)] object-cover" src={user?.avatarUrl} alt="User Avatar" />
                {user.role !== 'Resident' && (
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--card-bg-light)] dark:bg-[var(--card-bg-dark)] ring-1 ring-[var(--border-light)] dark:ring-[var(--border-dark)]">
                       <span className={`h-2.5 w-2.5 rounded-full ${user.role === 'Admin' ? 'bg-purple-500' : 'bg-orange-500'}`}></span>
                    </span>
                )}
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className="ml-4 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-red-500 dark:hover:text-red-400 transition-colors"
            aria-label="Logout"
          >
            <LogOutIcon />
          </button>
        </div>
      </header>
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
};

export default Header;
