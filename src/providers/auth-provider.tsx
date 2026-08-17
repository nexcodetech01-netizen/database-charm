import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  companyId: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Tracks the current Supabase auth session. Subscribes synchronously
 * to auth state changes and then fetches the initial session, per
 * Supabase's recommended pattern (avoids missed events).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('current_company_id')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        console.log("[AuthProvider] Profile loaded for user:", userId, "companyId:", data?.current_company_id);
        setCompanyId(data?.current_company_id || null);
      } catch (err) {
        console.error("[AuthProvider] Error fetching profile:", err);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        fetchProfile(nextUser.id);
      } else {
        setCompanyId(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        fetchProfile(nextUser.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      companyId,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [user, session, loading, companyId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
