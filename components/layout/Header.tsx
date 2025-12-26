
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

  const getUnitDisplay = () => {
      if (!user) return '';
      if (user.units && user.units.length > 0) {
          const primary = user.units[0];
          const primaryStr = `${primary.block ? primary.block + '-' : ''}${primary.flatNumber}`;
          if (user.units.length > 1) {
              return (
                  <span className="flex items-center gap-1">
                      {primaryStr}
                      <span className="bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                          +{user.units.length - 1}
                      </span>
                  </span>
              );
          }
          return primaryStr;
      }
      return user.flatNumber || '';
  };

  const getInitials = (name: string) => {
      return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <>
      <header className="flex justify-between items-center p-3 sm:p-5 bg-[var(--bg-light)]/80 dark:bg-[var(--bg-dark)]/60 backdrop-blur-xl border-b border-[var(--border-light)] dark:border-[var(--border-dark)] z-30 sticky top-0">
        <div className="flex items-center min-w-0">
            <div className="flex items-center gap-3 flex-shrink-0">
                <Logo className="w-10 h-10 text-brand-600" />
                <div className="flex flex-col">
                    <h2 className="text-2xl sm:text-3xl font-brand font-extrabold text-brand-600 tracking-tight leading-none">Nilayam</h2>
                    <span className="hidden sm:block text-[10px] font-bold text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] uppercase tracking-[0.2em] mt-1 opacity-70">
                        {user?.communityName || 'Management'}
                    </span>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-2xl text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-brand-600 transition-all border border-transparent hover:border-[var(--border-light)]"
            aria-label="Toggle theme"
          >
              {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
          </button>
          
          {user && (
            <>
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:bg-white dark:hover:bg-white/5 p-1.5 rounded-2xl sm:pr-4 transition-all group shadow-sm sm:shadow-none border border-transparent hover:border-[var(--border-light)]"
                  onClick={() => setIsProfileOpen(true)}
                >
                  <div className="relative">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-brand-600/20 group-hover:scale-105 transition-transform">
                          {getInitials(user.name)}
                      </div>
                  </div>
                  <div className="hidden md:block">
                      <p className="font-bold text-sm text-[var(--text-light)] dark:text-[var(--text-dark)] leading-none">{user.name}</p>
                      <div className="text-[10px] text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] font-bold mt-1.5 uppercase tracking-wider">
                          {getUnitDisplay()}
                      </div>
                  </div>
                </div>
                
                <button
                    onClick={logout}
                    className="p-2.5 text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all border border-transparent hover:border-red-100"
                    title="Sign Out"
                >
                    <LogOutIcon className="w-5 h-5" />
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
