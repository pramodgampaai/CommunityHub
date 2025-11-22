
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
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
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Use a ref to track the current user ID to avoid stale closures in the auth listener
  const userIdRef = useRef<string | null>(null);

  // Wrapper to keep ref in sync with state
  const setUser = (u: User | null) => {
      userIdRef.current = u ? u.id : null;
      setUserState(u);
  };

  const logout = async () => {
    try {
        // 1. Clear React State
        setUser(null);
        
        // 2. Sign out from Supabase
        await supabase.auth.signOut();

        // 3. Clear Local Storage (preserving theme)
        const theme = localStorage.getItem('theme');
        localStorage.clear();
        sessionStorage.clear();
        if (theme) localStorage.setItem('theme', theme);

        // 4. Clear cookies
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
        // 5. Redirect to home
        window.location.href = '/'; 
    } catch (error) {
        console.error("Logout error:", error);
        window.location.href = '/';
    }
  };

  // Helper to fetch and map profile
  const fetchProfile = async (session: Session) => {
      try {
        // Add a timestamp to bust any browser GET cache
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
            console.error("Error fetching profile:", error);
            return null;
        }

        if (profile) {
          return {
            id: profile.id,
            name: profile.name || 'User',
            email: profile.email || session.user.email || '',
            avatarUrl: profile.avatar_url || `https://i.pravatar.cc/150?u=${profile.id}`,
            flatNumber: profile.flat_number,
            role: profile.role as UserRole || UserRole.Resident,
            communityId: profile.community_id,
            status: profile.status || 'active',
            maintenanceStartDate: profile.maintenance_start_date
          } as User;
        }
        return null;
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
        return null;
      }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            // Check if we already processed this user (via listener race condition)
            if (userIdRef.current === session.user.id) {
                if (mounted) setLoading(false);
                return;
            }

            const userProfile = await fetchProfile(session);
            if (mounted) {
                if (userProfile) {
                    setUser(userProfile);
                } else {
                    console.warn("Session valid but profile not found.");
                    setUser(null);
                }
            }
        }
        if (mounted) setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
            setUser(null);
            setLoading(false);
        } else if (session) {
            // Check against Ref to see if we already have this user loaded
            // This is the critical fix for the "Hung" state
            if (userIdRef.current === session.user.id) {
                setLoading(false);
                return; 
            }
            
            // If ID matches ref, we do nothing. If different (or null), we fetch.
            const userProfile = await fetchProfile(session);
            if (mounted && userProfile) {
                setUser(userProfile);
            }
             // Ensure loading is false once we have a session event handled
            setLoading(false);
        } else {
             // No session, ensure loading is false
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
    // 1. Perform Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;

    if (data.session) {
        // 2. Validate Profile IMMEDIATELY
        const userProfile = await fetchProfile(data.session);
        
        if (!userProfile) {
            await supabase.auth.signOut();
            throw new Error("Login successful, but user profile not found. Please contact the Administrator.");
        }
        
        // 3. Update State
        setUser(userProfile);
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
