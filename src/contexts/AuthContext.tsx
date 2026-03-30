import React, {createContext, useState, useEffect, useContext} from 'react';
import {supabase} from '../services/supabase';
import type {User} from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({data: {session}}) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const {error} = await supabase.auth.signInWithPassword({email, password});
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const {error} = await supabase.auth.signUp({email, password});
    if (error) throw error;
  };

  const signOut = async () => {
    const {error} = await supabase.auth.signOut();
    if (error) throw error;
  };

  const deleteAccount = async () => {
    // Delete all user data then remove the auth account via edge function
    const {data: {session}} = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not signed in');

    // Call a Supabase edge function that deletes the user server-side
    // (client SDK cannot delete its own auth account; needs admin or edge function)
    const res = await fetch(`${(await import('../services/supabase')).supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? 'Failed to delete account. Please contact support.');
    }

    // Sign out locally after successful deletion
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{user, loading, signIn, signUp, signOut, deleteAccount}}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
