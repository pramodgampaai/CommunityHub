
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
              className="flex items-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-colors"
              onClick={() => setIsProfileOpen(true)}
              role="button"
              tabIndex={0}
            >
              <div className="text-right mr-3 hidden sm:block">
                <p className="font-semibold text-sm text-[var(--text-light)] dark:text-[var(--text-dark)]">{user.name}</p>
                <p className="text-xs text-[var(--text-secondary-light)] dark:text-[var(--text-secondary-dark)]">Flat: {user.flatNumber}</p>
              </div>
              <img className="w-10 h-10 rounded-full ring-2 ring-offset-2 ring-offset-[var(--card-bg-light)] dark:ring-offset-[var(--card-bg-dark)] ring-[var(--accent)]" src={user?.avatarUrl} alt="User Avatar" />
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
