import { supabase } from './client';
import { edgeErrorMessage } from './edge';

export interface EmailResult { emailed: boolean; reason: string | null }

/**
 * Ask the server to email the client about workouts just set, or a reply just written. This never throws: the in-app
 * notice does not depend on it, so a failed email is reported, never allowed to undo what the coach did.
 */
export async function notifyTraining(body: { kind: 'assigned'; assignment_ids: string[] } | { kind: 'feedback'; feedback_id: string }): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('notify-training', { body });
    if (error) return { emailed: false, reason: await edgeErrorMessage(error, 'The email service did not answer.') };
    const d = (data ?? {}) as { emailed?: boolean; email_error?: string };
    return { emailed: d.emailed === true, reason: d.emailed === true ? null : d.email_error ?? 'Unknown reason.' };
  } catch (e) {
    return { emailed: false, reason: e instanceof Error ? e.message : 'The email service did not answer.' };
  }
}

/** The sentence a coach reads after sending: whether the client was emailed too. */
export const emailNote = (r: EmailResult, who: string): string => (r.emailed ? ` ${who} has been emailed too.` : ` The email did not go (${r.reason ?? 'unknown reason'}), but ${who} will see it in the app.`);

/**
 * Ask the server to email a team member just added: welcome to the team, with the link to the staff app. Like the training email,
 * this never throws: the login already exists, so a failed email is reported, never allowed to undo it.
 */
export async function notifyStaffWelcome(gymId: string, userId: string): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('notify-staff-welcome', { body: { gym_id: gymId, user_id: userId } });
    if (error) return { emailed: false, reason: await edgeErrorMessage(error, 'The email service did not answer.') };
    const d = (data ?? {}) as { emailed?: boolean; email_error?: string };
    return { emailed: d.emailed === true, reason: d.emailed === true ? null : d.email_error ?? 'Unknown reason.' };
  } catch (e) {
    return { emailed: false, reason: e instanceof Error ? e.message : 'The email service did not answer.' };
  }
}

/** What the owner reads after adding someone: whether they were emailed the welcome and the link to the staff app. */
export const welcomeNote = (r: EmailResult, who: string): string =>
  r.emailed ? `We have emailed ${who} a welcome with the link to the staff app.` : `The welcome email did not go (${r.reason ?? 'unknown reason'}). Tell ${who} to sign in at hybridone.co.uk/login.`;
