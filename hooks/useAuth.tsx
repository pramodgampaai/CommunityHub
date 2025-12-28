
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getUserProfile } from '../services/api';
import type { User, Unit, TenantProfile } from '../types';
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
        localStorage.clear();
        sessionStorage.clear();
        // Clear cookies for good measure
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        window.location.href = '/'; 
    } catch (error) {
        console.error("Logout error:", error);
        window.location.href = '/';
    }
  };

  const transformProfile = (data: any, email: string): User => {
      const { units, ...userProfile } = data;
      
      const mappedUnits: Unit[] = (units || []).map((u: any) => ({
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
      
      // Normalize Role
      let resolvedRole = userProfile.role as string;
      if (resolvedRole === 'Tenant' || (resolvedRole === 'Resident' && userProfile.profile_data?.is_tenant)) {
          resolvedRole = UserRole.Tenant;
      }

      return {
          id: userProfile.id,
          name: userProfile.name || 'User',
          email: userProfile.email || email || '',
          avatarUrl: userProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name || 'U')}&background=random`,
          flatNumber: primaryUnit ? primaryUnit.flatNumber : userProfile.flat_number,
          role: resolvedRole as UserRole,
          communityId: userProfile.community_id,
          communityName: userProfile.role === UserRole.SuperAdmin ? 'Platform Owner' : (userProfile.community_name || 'Community'), 
          status: userProfile.status || 'active',
          maintenanceStartDate: userProfile.maintenance_start_date,
          units: mappedUnits,
          theme: userProfile.theme as 'light' | 'dark' | undefined,
          tenantDetails: userProfile.profile_data
      };
  };

  const fetchProfile = async (session: Session): Promise<User | null> => {
      // 1. FAST PATH: Metadata (Immediate UI render capability)
      const meta = session.user.user_metadata;
      let fallbackUser: User | null = null;
      
      if (meta && (meta.community_id || meta.communityId)) {
           fallbackUser = {
               id: session.user.id,
               name: meta.name || 'User',
               email: session.user.email || '',
               role: (meta.role as UserRole) || UserRole.Resident,
               communityId: meta.community_id || meta.communityId,
               communityName: 'Community Member',
               flatNumber: meta.flat_number || '',
               avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(meta.name || 'U')}&background=random`,
               status: 'active',
               units: [], // Important for App.tsx setup check
               tenantDetails: meta as unknown as TenantProfile
           };
      }

      // 2. PRIMARY PATH: Edge Function (Full Data)
      try {
          const efData = await getUserProfile(session.access_token);
          if (efData && !efData.error) {
              const fullUser = transformProfile(efData, session.user.email || '');
              
              // Enrich Community Name if not present
              if (fullUser.communityId) {
                  try {
                      const { data: comm } = await supabase.from('communities').select('name').eq('id', fullUser.communityId).single();
                      if (comm) fullUser.communityName = comm.name;
                  } catch (e) { /* ignore */ }
              }
              return fullUser;
          }
      } catch (efErr) {
          console.warn("Edge Function profile fetch failed. Falling back.", efErr);
      }

      // 3. FALLBACK PATH: Direct DB (If Edge Function fails/timeouts)
      try {
          const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (!error && profile) {
              const { data: unitsData } = await supabase.from('units').select('*').eq('user_id', session.user.id);
              return transformProfile({ ...profile, units: unitsData }, session.user.email || '');
          }
      } catch (dbErr) {
          console.error("DB Profile fetch failed", dbErr);
      }

      // Return metadata fallback if everything else failed, otherwise null
      return fallbackUser;
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const userProfile = await fetchProfile(session);
                if (mounted) setUser(userProfile);
            }
        } catch (e) {
            console.error("Auth init error", e);
        } finally {
            if (mounted) setLoading(false);
        }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        
        if (event === 'SIGNED_OUT') {
            setUser(null);
            setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session) {
                // Optimization: Only fetch if we don't have a user or user ID changed
                if (!userIdRef.current || userIdRef.current !== session.user.id) {
                    const userProfile = await fetchProfile(session);
                    if (mounted) setUser(userProfile);
                }
            }
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;

    if (data.session) {
        setLoading(true);
        const userProfile = await fetchProfile(data.session);
        setUser(userProfile);
        setLoading(false);
        
        if (!userProfile) {
            throw new Error("Login succeeded but profile could not be loaded. Please contact support.");
        }
    }
  };

  const refreshUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
          const userProfile = await fetchProfile(session);
          if (userProfile) setUser(userProfile);
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
