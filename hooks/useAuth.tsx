
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
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const setUser = (u: User | null) => {
      userIdRef.current = u ? u.id : null;
      setUserState(u);
  };

  const logout = async () => {
    try {
        setUser(null);
        await supabase.auth.signOut();
        // Clear all local storage except theme (which we aren't using anymore anyway)
        // but just to be clean, clear everything.
        localStorage.clear();
        sessionStorage.clear();
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        window.location.href = '/'; 
    } catch (error) {
        console.error("Logout error:", error);
        window.location.href = '/';
    }
  };

  // Robust Fetch Profile Strategy
  const fetchProfile = async (session: Session) => {
      try {
        // Step 1: Fetch Basic User Profile
        // We separate the join to ensure we get the user even if community lookup fails (e.g. partial outage or RLS issue on communities)
        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
             console.error("Fetch profile error (public.users):", error);
             return null;
        }
        if (!profile) {
             console.error("Profile not found in public.users for ID:", session.user.id);
             return null;
        }

        // Step 1.5: Fetch Community Name (Best Effort)
        let communityName = undefined;
        if (profile.community_id) {
            const { data: comm } = await supabase.from('communities').select('name').eq('id', profile.community_id).single();
            if (comm) communityName = comm.name;
        } else if (profile.role === UserRole.SuperAdmin) {
            communityName = 'Platform Owner';
        }

        // Step 2: Fetch Units (Best effort, might fail if table missing)
        let units: any[] = [];
        try {
            const { data: unitsData } = await supabase
                .from('units')
                .select('*')
                .eq('user_id', session.user.id);
            if (unitsData) units = unitsData;
        } catch (unitErr) {
            console.warn("Failed to fetch user units", unitErr);
        }

        // Step 3: Map
        const mappedUnits: Unit[] = units.map((u: any) => ({
            id: u.id,
            userId: u.user_id,
            communityId: u.community_id,
            flatNumber: u.flat_number,
            block: u.block,
            floor: u.floor,
            flatSize: u.flat_size,
            maintenanceStartDate: u.maintenance_start_date
        }));

        const primaryUnit = mappedUnits.length > 0 ? mappedUnits[0] : null;
        
        // Resolve Theme: Directly from database profile
        // If the column doesn't exist yet in the user's view (schema cache issue), this might be undefined, which is fine (defaults to system pref in App.tsx)
        const storedTheme = profile.theme;

        return {
            id: profile.id,
            name: profile.name || 'User',
            email: profile.email || session.user.email || '',
            avatarUrl: profile.avatar_url || `https://i.pravatar.cc/150?u=${profile.id}`,
            flatNumber: primaryUnit ? primaryUnit.flatNumber : profile.flat_number,
            role: profile.role as UserRole || UserRole.Resident,
            communityId: profile.community_id, // Can be null for SuperAdmin
            communityName: communityName,
            status: profile.status || 'active',
            maintenanceStartDate: profile.maintenance_start_date,
            units: mappedUnits,
            theme: storedTheme as 'light' | 'dark' | undefined
        } as User;

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
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const userProfile = await fetchProfile(session);
                if (mounted) {
                    if (userProfile) {
                        setUser(userProfile);
                    } else {
                         // Session valid but profile not found.
                         // This usually happens if the public.users row was deleted or permissions are wrong.
                         console.warn("Session valid but profile not found.");
                         setUser(null);
                    }
                }
            } else {
                if (mounted) setUser(null);
            }
        } catch (error) {
            console.error("Auth initialization error:", error);
            if (mounted) setUser(null);
        } finally {
            if (mounted) setLoading(false);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session: Session | null) => {
                if (!mounted) return;
                if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setLoading(false);
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    if (session) {
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;

    if (data.session) {
        const userProfile = await fetchProfile(data.session);
        if (!userProfile) {
            // Force logout if profile is missing to prevent stuck state
            await supabase.auth.signOut();
            throw new Error("Login successful, but user profile not found. Please contact the Administrator.");
        }
        setUser(userProfile);
    }
  };

  const refreshUser = async () => {
      try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
              const userProfile = await fetchProfile(session);
              if (userProfile) {
                  setUser(userProfile);
              }
          }
      } catch (error) {
          console.error("Failed to refresh user profile:", error);
      }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
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
