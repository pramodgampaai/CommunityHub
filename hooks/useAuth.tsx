
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import type { User, Unit } from '../types';
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
  
  // Use a ref to track the current user ID to avoid stale closures and redundant fetches
  const userIdRef = useRef<string | null>(null);

  // Wrapper to keep ref in sync with state
  const setUser = (u: User | null) => {
      userIdRef.current = u ? u.id : null;
      setUserState(u);
  };

  const logout = async () => {
    try {
        // 1. Clear React State immediately
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
        
        // 5. Redirect to home/login
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
        // CRITICAL UPDATE: Select units relation
        const { data: profile, error } = await supabase
          .from('users')
          .select('*, units(*)')
          .eq('id', session.user.id)
          .single();

        if (error) {
            console.error("Error fetching profile:", error);
            return null;
        }

        if (profile) {
          // Map Units from DB (snake_case) to Type (camelCase)
          const mappedUnits: Unit[] = profile.units?.map((u: any) => ({
              id: u.id,
              userId: u.user_id,
              communityId: u.community_id,
              flatNumber: u.flat_number,
              block: u.block,
              floor: u.floor,
              flatSize: u.flat_size,
              maintenanceStartDate: u.maintenance_start_date
          })) || [];

          return {
            id: profile.id,
            name: profile.name || 'User',
            email: profile.email || session.user.email || '',
            avatarUrl: profile.avatar_url || `https://i.pravatar.cc/150?u=${profile.id}`,
            flatNumber: profile.flat_number, // Legacy/Fallback
            role: profile.role as UserRole || UserRole.Resident,
            communityId: profile.community_id,
            status: profile.status || 'active',
            maintenanceStartDate: profile.maintenance_start_date,
            units: mappedUnits // Now populated
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
    let authSubscription: any = null;

    const initializeAuth = async () => {
        try {
            // 1. Check for existing session first (Synchronous-like check)
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                // We have a session, fetch the profile
                const userProfile = await fetchProfile(session);
                if (mounted) {
                    if (userProfile) {
                        setUser(userProfile);
                    } else {
                         // Session exists but profile is missing (e.g. deleted user)
                         // Treat as logged out
                         console.warn("Session valid but profile not found.");
                         setUser(null);
                    }
                }
            } else {
                // No session
                if (mounted) setUser(null);
            }
        } catch (error) {
            console.error("Auth initialization error:", error);
            if (mounted) setUser(null);
        } finally {
            // 2. ALWAYS set loading to false after the initial check is done
            if (mounted) setLoading(false);
        }

        // 3. Subscribe to changes AFTER initial load to handle future events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session: Session | null) => {
                if (!mounted) return;

                if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setLoading(false);
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    if (session) {
                        // Only fetch if the user ID has changed (avoid redundant fetches on refresh tokens)
                        if (userIdRef.current !== session.user.id) {
                             const userProfile = await fetchProfile(session);
                             if (mounted && userProfile) {
                                 setUser(userProfile);
                             }
                        }
                    }
                }
            }
        );
        authSubscription = subscription;
    };

    initializeAuth();

    return () => {
      mounted = false;
      if (authSubscription) authSubscription.unsubscribe();
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
