import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { getSession, onSessionChange, signOut as dataSignOut } from '../data/auth';
import { listActiveGyms, newestMembership, type GymAccess } from '../data/memberships';
import { resolveAccess, type Access } from './access';
import { clearSelectedGymId, getSelectedGymId, setSelectedGymId } from './gymStorage';

/** Legacy pages that own sign-in and gym choice until those screens move. */
export const LEGACY_LOGIN = '../login.html';
export const LEGACY_CHOOSER = '../choose-gym.html';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'choose-gym'; userId: string; gyms: GymAccess[] }
  | { status: 'no-access'; userId: string }
  | {
      status: 'ready';
      userId: string;
      email: string;
      gym: GymAccess;
      gyms: GymAccess[];
      access: Access;
      signOut: () => Promise<void>;
    };

const AuthContext = createContext<AuthState>({ status: 'loading' });

/**
 * The single owner of "who is the user and which gym are they in".
 * Person first: a session, then active memberships, then ONE selected gym
 * that must match an active membership. No email-to-gym inference, no
 * first-row fallback, no last-used gym as permission.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    getSession().then((s) => live && setSession(s), () => live && setSession(null));
    const off = onSessionChange((s) => {
      setSession(s);
      if (!s) qc.clear();
    });
    return () => {
      live = false;
      off();
    };
  }, [qc]);

  const userId = session?.user.id ?? '';
  const gymsQ = useQuery({ queryKey: ['gyms', userId], queryFn: () => listActiveGyms(userId), enabled: !!userId });
  const gyms = gymsQ.data;

  const selected = useMemo(() => {
    if (!gyms) return undefined;
    const wanted = getSelectedGymId();
    const match = gyms.find((g) => g.gymId === wanted);
    if (match) return match;
    return gyms.length === 1 ? gyms[0] : undefined;
  }, [gyms]);

  const gymId = selected?.gymId ?? '';
  const memQ = useQuery({
    queryKey: ['membership', userId, gymId],
    queryFn: () => newestMembership(userId, gymId),
    enabled: !!userId && !!gymId,
  });

  const state = useMemo<AuthState>(() => {
    if (session === undefined) return { status: 'loading' };
    if (!session) return { status: 'signed-out' };
    if (!gyms || (selected && memQ.data === undefined && memQ.isLoading)) return { status: 'loading' };
    if (gyms.length === 0) return { status: 'no-access', userId };
    if (!selected) return { status: 'choose-gym', userId, gyms };
    const today = new Date().toISOString().slice(0, 10);
    return {
      status: 'ready',
      userId,
      email: session.user.email ?? '',
      gym: selected,
      gyms,
      access: resolveAccess(selected.role, memQ.data ?? null, today),
      signOut: async () => {
        await dataSignOut();
        clearSelectedGymId();
      },
    };
  }, [session, gyms, selected, memQ.data, memQ.isLoading, userId]);

  useEffect(() => {
    if (state.status === 'ready') setSelectedGymId(state.gym.gymId);
  }, [state]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** For screens inside the shell, where the state is always 'ready'. */
export function useReadyAuth(): Extract<AuthState, { status: 'ready' }> {
  const s = useAuth();
  if (s.status !== 'ready') throw new Error('useReadyAuth used outside a signed-in gym');
  return s;
}
