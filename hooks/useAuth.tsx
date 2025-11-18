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
    
    // The onAuthStateChange listener is the single source of truth for the user's session.
    // It fires once on initial load, and again whenever the session changes (e.g., login, logout).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (session) {
          // When a session is detected, fetch the user's profile from the database.
          // We use an RPC call to a custom database function `get_user_profile` for this.
          const { data: profileData, error } = await supabase.rpc('get_user_profile');

          if (error) {
            console.error('Error fetching user profile:', error);
            setUser(null);
          } else if (profileData && profileData.length > 0) {
            // Profile found, map it to our User type
            const profile = profileData[0];
            const appUser: User = {
              id: profile.id,
              name: profile.name || 'Resident',
              email: profile.email || '',
              avatarUrl: profile.avatar_url || `https://i.pravatar.cc/150?u=${profile.id}`,
              flatNumber: profile.flat_number || 'N/A',
              role: profile.role as UserRole || UserRole.Resident,
            };
            setUser(appUser);
          } else if (session.user) {
            // No profile found for an authenticated user, let's create one.
            console.log('User profile not found, creating a new one.');
            const { data: newUserProfile, error: insertError } = await supabase
              .from('users')
              .insert({
                id: session.user.id, // The UUID from the authenticated user
                email: session.user.email,
                name: session.user.email?.split('@')[0] || 'New User',
                flat_number: 'N/A',
                role: UserRole.Resident, // Default role for new users
              })
              .select()
              .single();
            
            if (insertError) {
              console.error('Failed to create user profile:', insertError);
              // As a fallback, sign out to prevent a broken state
              await supabase.auth.signOut();
              setUser(null);
            } else if (newUserProfile) {
              // New profile created successfully, map it to our User type
              const appUser: User = {
                id: newUserProfile.id,
                name: newUserProfile.name || 'Resident',
                email: newUserProfile.email || '',
                avatarUrl: newUserProfile.avatar_url || `https://i.pravatar.cc/150?u=${newUserProfile.id}`,
                flatNumber: newUserProfile.flat_number || 'N/A',
                role: newUserProfile.role as UserRole || UserRole.Resident,
              };
              setUser(appUser);
            }
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