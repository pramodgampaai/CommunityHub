
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getUserProfile } from '../services/api';
import type { User, Unit, TenantProfile } from '../types';
import { UserRole } from '../types';
import type { Session } from '@supabase/supabase-js';

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
  const isFetchingRef = useRef<boolean>(false);

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
      if (isFetchingRef.current) return null;
      isFetchingRef.current = true;
      
      try {
          // Metadata Fallback (Immediate)
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
                  units: [],
                  tenantDetails: meta as any
              };
          }

          // Full Profile (Edge Function)
          const efData = await getUserProfile(session.access_token);
          if (efData && !efData.error) {
              const fullUser = transformProfile(efData, session.user.email || '');
              if (fullUser.communityId) {
                  const { data: comm } = await supabase.from('communities').select('name').eq('id', fullUser.communityId).single();
                  if (comm) fullUser.communityName = comm.name;
              }
              return fullUser;
          }
          return fallbackUser;
      } catch (e) {
          console.warn("Profile fetch failed", e);
          return null;
      } finally {
          isFetchingRef.current = false;
      }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            
            // Clear session if refresh token is missing/invalid to stop loops
            if (error?.message?.includes("refresh_token_not_found") || error?.message?.includes("Invalid Refresh Token")) {
                console.error("Auth session corrupted, clearing...");
                await supabase.auth.signOut();
                return;
            }

            if (session && mounted) {
                const userProfile = await fetchProfile(session);
                if (mounted && userProfile) setUser(userProfile);
            }
        } catch (e) {
            console.error("Auth init crash", e);
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
                try {
                    // Deduplication: Only fetch if user identity changed or we have no user
                    if (userIdRef.current !== session.user.id) {
                        const userProfile = await fetchProfile(session);
                        if (mounted && userProfile) setUser(userProfile);
                    }
                } catch (e) {
                    console.error("Profile update failed after auth event", e);
                } finally {
                    // CRITICAL: Ensure loading is set to false so the app renders
                    if (mounted) setLoading(false);
                }
            } else {
                if (mounted) setLoading(false);
            }
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        // SIGNED_IN event will be picked up by the listener above to fetch profile and clear loading
    } catch (e) {
        setLoading(false);
        throw e;
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
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
