import { supabase } from './client';
import { edgeErrorMessage } from './edge';

/**
 * Asks Stripe to match the database for one membership (stop billing a member who has left, schedule the stop for a future last day,
 * or take a scheduled stop back). Best effort: it returns the problem as words, or null when all is well. Memberships not paid through
 * Stripe are left alone by the function, so calling it for any membership is safe.
 */
export async function syncStripe(membershipId: string): Promise<string | null> {
  try {
    const { error } = await supabase.functions.invoke('stripe-membership-sync', { body: { membership_id: membershipId } });
    return error ? await edgeErrorMessage(error, 'Stripe did not answer.') : null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Stripe did not answer.';
  }
}

/** Owner or admin ends a membership today (lastDay null) or on a last day, whatever the term and notice. A reason is required. */
export async function endMembership(membershipId: string, lastDay: string | null, reason: string): Promise<void> {
  const { error } = await supabase.rpc('staff_end_membership', { p_membership_id: membershipId, p_last_day: lastDay, p_reason: reason.trim() });
  if (error) throw new Error(error.message);
}

/** Owner or admin lets one member leave without serving the rest of their minimum term. A reason is required. */
export async function releaseFromTerm(membershipId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('staff_release_from_term', { p_membership_id: membershipId, p_reason: reason.trim() });
  if (error) throw new Error(error.message);
}

/** Passes a plan's saved terms to its existing members, only where that is the same or better for them. Returns how many changed. */
export async function applyPlanTerms(planId: string, reason: string): Promise<number> {
  const { data, error } = await supabase.rpc('apply_plan_terms_to_members', { p_plan_id: planId, p_reason: reason.trim() });
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : 0;
}
