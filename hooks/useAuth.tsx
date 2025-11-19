import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { User } from '../types';
import { UserRole } from '../types';
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
    setLoading(true);
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (session) {
          const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            const appUser: User = {
              id: profile.id,
              name: profile.name || 'User',
              email: profile.email || session.user.email || '',
              avatarUrl: profile.avatar_url || `https://i.pravatar.cc/150?u=${profile.id}`,
              flatNumber: profile.flat_number,
              role: profile.role as UserRole || UserRole.Resident,
              communityId: profile.community_id,
              status: profile.status || 'active',
            };
            setUser(appUser);
          } else if (error && error.code === 'PGRST116') {
            // This error means no profile was found for the authenticated user.
            console.error(
              'CRITICAL: User is authenticated but profile was not found. ' +
              'This could be due to replication delay or a failed backend trigger (`handle_new_user`). Signing out for security.',
              { userId: session.user.id }
            );
            await supabase.auth.signOut();
            setUser(null);
          } else if (error) {
            // A different, unexpected error occurred during profile fetch.
             console.error('Error fetching user profile:', error.message || error);
             await supabase.auth.signOut();
             setUser(null);
          }
        } else {
            // If there's no session, ensure user is null.
            setUser(null);
        }
        setLoading(false);
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