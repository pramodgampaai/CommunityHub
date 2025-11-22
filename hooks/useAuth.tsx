
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

  // Define logout first so it can be used in fetchProfile
  const logout = async () => {
    // 1. Clear React State immediately
    setUser(null);
    
    try {
        const theme = localStorage.getItem('theme');
        
        // 2. Attempt server-side sign out (best effort, don't block)
        await Promise.race([
            supabase.auth.signOut(),
            new Promise(resolve => setTimeout(resolve, 500)) // Timeout after 500ms
        ]).catch(err => console.warn("Supabase signOut warning:", err));

        // 3. Nuke ALL Storage
        localStorage.clear();
        sessionStorage.clear();
        
        // 4. Attempt to clear cookies (if any exist)
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });

        // 5. Restore Theme Preference
        if (theme) {
            localStorage.setItem('theme', theme);
        }
        
    } catch (error) {
        console.error("Logout error:", error);
    } finally {
        // 6. HARD RELOAD to ensure a completely clean JS environment
        window.location.href = '/';
    }
  };

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async (session: Session) => {
      try {
        // Add a timestamp to bust any browser GET cache
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!mounted) return;

        if (error) {
            console.error("Error fetching profile from public.users:", error);
            // If we have a session but can't read the profile (RLS error or missing row),
            // we must logout to prevent getting stuck.
            if (error.code === 'PGRST116' || error.code === '42501') { // Not found or Permission denied
                console.warn("Profile missing or inaccessible. Logging out.");
                await logout();
                return;
            }
        }

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
          // Force cleanup if profile doesn't exist
          await logout();
        }
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
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
