import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Subscription, SubscriptionTier } from '@/lib/types';
import { buildEmailRedirectTo } from '@/lib/signupResult';

export const FREE_INVOICE_LIMIT = 3;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  tier: SubscriptionTier;
  isAdmin: boolean;
  subscription: Subscription | null;
  signUp: (email: string, password: string) => Promise<{ error: string | null; sessionEstablished: boolean; emailRedirectTo: string }>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshTier: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadSubscription = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setSubscription(data as Subscription | null);

    const { data: adminResult } = await supabase.rpc('is_current_user_admin');
    setIsAdmin(adminResult === true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadSubscription(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadSubscription(newSession.user.id);
      } else {
        setSubscription(null);
        setIsAdmin(false);
      }
    });

    return () => { listener.subscription.unsubscribe(); };
  }, [loadSubscription]);

  const signUp = useCallback(async (email: string, password: string) => {
    const emailRedirectTo = buildEmailRedirectTo(window.location.origin);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
    return { error: error?.message || null, sessionEstablished: !!data.session, emailRedirectTo };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const emailRedirectTo = buildEmailRedirectTo(window.location.origin);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo },
    });
    return { error: error?.message || null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSubscription(null);
  }, []);

  const refreshTier = useCallback(async () => {
    if (session?.user) await loadSubscription(session.user.id);
  }, [session, loadSubscription]);

  const tier: SubscriptionTier =
    isAdmin
      ? 'admin'
      : subscription?.tier === 'pro'
        ? 'pro'
        : subscription?.tier === 'business'
          ? 'business'
          : subscription?.tier === 'enterprise'
            ? 'enterprise'
            : 'free';

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null, loading,
      tier, isAdmin, subscription,
      signUp, signIn, signOut, refreshTier, resendConfirmation,
    }}>

      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- context hook lives alongside its provider
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
