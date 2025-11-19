
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
    // Initial loading state
    setLoading(true);
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        try {
          if (session) {
            // If we have a session, try to fetch the user profile
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
            } else {
              // Profile missing or error occurred
              console.error(
                'Profile fetch error or profile missing.', 
                error ? error.message : 'No profile found'
              );
              
              // If the error indicates the session is actually invalid (e.g. JWT expired/bad), 
              // we should clear the session to prevent a refresh loop.
              // We catch the signOut error to ensure we don't crash here.
              await supabase.auth.signOut().catch(err => console.warn("Safe signout failed", err));
              setUser(null);
            }
          } else {
            // No session (SIGNED_OUT)
            setUser(null);
          }
        } catch (err) {
          console.error("Unexpected error in AuthProvider:", err);
          setUser(null);
        } finally {
          // CRITICAL: Always set loading to false, otherwise the app hangs on the spinner.
          setLoading(false);
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
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error("Logout error:", error);
    } finally {
        // Ensure local state is cleared even if the server request fails
        setUser(null);
        // Optional: Clear local storage manually if needed, though supabase client handles it.
        // localStorage.removeItem('sb-<your-project-id>-auth-token'); 
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
