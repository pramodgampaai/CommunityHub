
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { User } from '../types';
import { UserRole } from '../types';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';


interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async (session: Session) => {
      try {
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!mounted) return;

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
        } else {
          console.warn('Profile missing for authenticated user.');
          // Do NOT auto-logout here to avoid loops. Just set user to null or limited state.
          setUser(null); 
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Initial loading state
    setLoading(true);
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;

        if (session) {
          // If we already have the user loaded and IDs match, don't re-fetch
          // This prevents thrashing on token refreshes
          if (user && user.id === session.user.id) {
             setLoading(false);
             return;
          }
          await fetchProfile(session);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
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
    // 1. IMMMEDIATELY clear local state to update UI and stop any hooks
    setUser(null);
    
    try {
        // 2. Attempt server-side sign out
        await supabase.auth.signOut();
        
        // 3. Force clear local storage keys for Supabase to ensure clean slate
        // This handles cases where signOut might fail due to network or invalid tokens
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        if (supabaseUrl) {
            localStorage.removeItem(`sb-${supabaseUrl}-auth-token`);
        }
    } catch (error) {
        console.error("Logout warning (usually harmless):", error);
    }
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
