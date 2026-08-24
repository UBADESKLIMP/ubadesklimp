import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const STAFF_EMAIL_DOMAIN = 'equipe.ubadesklimp.internal';
// Precisa ser idêntico ao sufixo em supabase/functions/criar-funcionario —
// é o que completa o PIN de 4 dígitos até o piso de 6 caracteres que o
// Supabase Auth exige (trava do dashboard, não configurável).
const STAFF_PIN_SUFFIX = '-pin';

// Login de funcionário usa um "usuário" (ex. "leticia"), sem e-mail de verdade.
// Resolve pra um e-mail sintético determinístico, sem round-trip ao banco.
const resolveLoginEmail = (identifier: string): string => {
  const trimmed = identifier.trim();
  return trimmed.includes('@') ? trimmed : `${trimmed.toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
};

// Login de funcionário com PIN novo (4 dígitos) precisa do sufixo pra bater
// com a senha real salva no Auth. Só aplica quando o texto digitado é
// exatamente 4 dígitos — funcionários criados antes dessa mudança ainda têm
// a senha alfanumérica antiga e devem continuar entrando sem alteração.
const resolveLoginPassword = (identifier: string, password: string): string =>
  !identifier.trim().includes('@') && /^\d{4}$/.test(password)
    ? `${password}${STAFF_PIN_SUFFIX}`
    : password;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // O GoTrueClient do Supabase relê a sessão do localStorage e reemite
    // SIGNED_IN toda vez que a aba volta a ficar visível, mesmo sem token
    // ter mudado — sempre com um objeto novo (referência diferente, mesmo
    // conteúdo). Sem esse guard, isso propaga "referência trocou" pra todo
    // hook com `useEffect(..., [user])` (useStaffAccess, useProfile etc.),
    // que voltam a `loading: true` e refazem a busca — dá a impressão de
    // que o app inteiro reinicia sempre que a pessoa troca de aba e volta.
    const applySession = (nextSession: Session | null) => {
      setSession((prev) => (prev?.access_token === nextSession?.access_token ? prev : nextSession));
      setUser((prev) => (prev?.id === nextSession?.user?.id ? prev : nextSession?.user ?? null));
      setLoading(false);
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        applySession(session);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (error) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Cadastro realizado!",
        description: "Verifique seu email para confirmar a conta.",
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: resolveLoginEmail(email),
      password: resolveLoginPassword(email, password),
    });

    if (error) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta!",
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
  };

  const isAdmin = async (): Promise<boolean> => {
    if (!user) return false;

    const { data, error } = await supabase
      .from('staff_members')
      .select('is_admin')
      .eq('user_id', user.id)
      .maybeSingle();

    return !error && !!data?.is_admin;
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};