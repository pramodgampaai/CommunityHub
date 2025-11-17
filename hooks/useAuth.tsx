import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { User } from '../types';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';


interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const appUser: User = {
          id: session.user.id,
          name: session.user.user_metadata.name || 'Resident',
          email: session.user.email || '',
          avatarUrl: session.user.user_metadata.avatar_url || `https://i.pravatar.cc/150?u=${session.user.id}`,
          flatNumber: session.user.user_metadata.flat_number || 'N/A'
        };
        setUser(appUser);
      }
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (session) {
           const appUser: User = {
              id: session.user.id,
              name: session.user.user_metadata.name || 'Resident',
              email: session.user.email || '',
              avatarUrl: session.user.user_metadata.avatar_url || `https://i.pravatar.cc/150?u=${session.user.id}`,
              flatNumber: session.user.user_metadata.flat_number || 'N/A'
            };
            setUser(appUser);
        } else {
            setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  

  const login = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
        throw error;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};