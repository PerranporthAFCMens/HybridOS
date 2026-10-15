import { supabase } from './client';
import { edgeErrorMessage } from './edge';

export interface StravaConnection {
  status: string;
  lastSyncedAt: string | null;
}

export interface StravaActivity {
  id: string;
  name: string;
  kind: string;
  startedAt: string;
  distanceM: number;
  movingSeconds: number | null;
}

/** The member's own Strava connection for this gym, or null when they have not connected. */
export async function getMyStrava(gymId: string, userId: string): Promise<StravaConnection | null> {
  const { data, error } = await supabase.from('strava_connections').select('status, last_synced_at').eq('gym_id', gymId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? { status: data.status, lastSyncedAt: data.last_synced_at } : null;
}

/** The member's ten latest imported activities. */
export async function listMyActivities(userId: string): Promise<StravaActivity[]> {
  const { data, error } = await supabase
    .from('strava_activities')
    .select('id, name, sport_type, activity_type, started_at, distance_m, moving_seconds')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []).map((x) => ({
    id: x.id,
    name: x.name,
    kind: x.sport_type ?? x.activity_type ?? 'Activity',
    startedAt: x.started_at,
    distanceM: Number(x.distance_m ?? 0),
    movingSeconds: x.moving_seconds,
  }));
}

/** Start the Strava sign-in. Returns the address to go to, or a message when Strava is not set up yet. */
export async function startStravaConnect(gymId: string): Promise<{ url: string } | { message: string }> {
  const { data, error } = await supabase.functions.invoke('strava-connect', { body: { gym_id: gymId, redirect_to: window.location.href } });
  if (error) throw new Error(await edgeErrorMessage(error, 'Could not start the Strava connection.'));
  if (!data?.configured || typeof data.authorize_url !== 'string') return { message: 'Strava is not switched on for this gym yet.' };
  return { url: data.authorize_url };
}

/** Pull in new activities. Returns how many were added or updated, or a message when Strava is not set up. */
export async function syncStrava(gymId: string): Promise<{ imported: number } | { message: string }> {
  const { data, error } = await supabase.functions.invoke('strava-sync', { body: { gym_id: gymId } });
  if (error) throw new Error(await edgeErrorMessage(error, 'Sync failed.'));
  if (data?.configured === false) return { message: typeof data.message === 'string' ? data.message : 'Strava is not switched on for this gym yet.' };
  return { imported: Number(data?.imported ?? 0) };
}
