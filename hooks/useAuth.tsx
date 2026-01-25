
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getUserProfile } from '../services/api';
import type { User, Unit } from '../types';
import { UserRole } from '../types';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastTokenRef = useRef<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  const updateIfChanged = (newUser: User | null) => {
      setUserState(prev => {
          const oldStr = JSON.stringify(prev);
          const newStr = JSON.stringify(newUser);
          if (oldStr === newStr) return prev;
          return newUser;
      });
  };

  const transformProfile = (data: any, email: string): User => {
      const { units, ...userProfile } = data;
      const mappedUnits: Unit[] = (units || []).map((u: any) => ({
          id: u.id, userId: u.user_id, communityId: u.community_id, flatNumber: u.flat_number,
          block: u.block, floor: u.floor, flatSize: u.flat_size, maintenanceStartDate: u.maintenance_start_date
      }));
      const primaryUnit = mappedUnits.length > 0 ? mappedUnits[0] : null;
      let resolvedRole = userProfile.role as UserRole;
      if (resolvedRole === UserRole.Resident && userProfile.profile_data?.is_tenant) resolvedRole = UserRole.Tenant;

      return {
          id: userProfile.id, name: userProfile.name || 'User', email: userProfile.email || email || '',
          avatarUrl: userProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name || 'U')}&background=random`,
          flatNumber: primaryUnit ? primaryUnit.flatNumber : userProfile.flat_number,
          role: resolvedRole, communityId: userProfile.community_id,
          communityName: userProfile.community_name || (userProfile.role === UserRole.SuperAdmin ? 'Platform' : 'Community'),
          status: userProfile.status || 'active', units: mappedUnits, theme: userProfile.theme,
          tenantDetails: userProfile.profile_data,
          profile_data: userProfile.profile_data
      };
  };

  const fetchProfile = async (session: Session): Promise<User | null> => {
      if (isFetchingRef.current) return null;
      isFetchingRef.current = true;
      
      try {
          if (session.access_token !== lastTokenRef.current) {
              await new Promise(r => setTimeout(r, 250));
          }

          const efData = await getUserProfile(session.access_token);
          
          if (efData && !efData.error) {
              return transformProfile(efData, session.user.email || '');
          }
          
          const errorMsg = efData?.error || "";
          if (errorMsg.includes("sub claim") || errorMsg.includes("not found")) {
              await internalLogout();
          }
          
          return null;
      } catch (e: any) {
          const msg = e.message || "";
          if (msg.includes("sub claim") || msg.includes("does not exist")) {
              await internalLogout();
          }
          return null;
      } finally {
          isFetchingRef.current = false;
      }
  };

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        
        const currentToken = session?.access_token || null;
        const isNewToken = currentToken !== lastTokenRef.current;
        
        if (event === 'SIGNED_OUT') {
            lastTokenRef.current = null;
            updateIfChanged(null);
            setLoading(false);
        } else if (session && (isNewToken || event === 'SIGNED_IN')) {
            lastTokenRef.current = currentToken;
            const profile = await fetchProfile(session);
            if (mounted) {
                if (profile) updateIfChanged(profile);
                setLoading(false);
            }
        } else if (!session) {
            lastTokenRef.current = null;
            updateIfChanged(null);
            setLoading(false);
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    // Clear legacy memory cache before signing in to prevent data leakage
    localStorage.removeItem('supabase.auth.token'); 
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  const refreshUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
          const profile = await fetchProfile(session);
          if (profile) updateIfChanged(profile);
      }
  };

  const updateUser = (data: Partial<User>) => {
      setUserState(prev => prev ? { ...prev, ...data } : null);
  };

  const internalLogout = async () => {
    lastTokenRef.current = null;
    setUserState(null);
    setLoading(false);
    await supabase.auth.signOut();
    localStorage.clear();
    // Force reload to clear all in-memory API caches
    window.location.reload(); 
  };

  const logout = async () => {
    await internalLogout();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
