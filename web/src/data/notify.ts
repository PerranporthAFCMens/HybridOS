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

export interface WelcomeResult extends EmailResult { setPassword: boolean }

/**
 * Ask the server to email a team member the welcome: "Choose your password" for someone who has never signed in, otherwise the link to
 * the staff app. `resend` is for "send the welcome again". Like the training email, this never throws: the login already exists, so a
 * failed email is reported, never allowed to undo it.
 */
export async function notifyStaffWelcome(gymId: string, userId: string, resend = false): Promise<WelcomeResult> {
  try {
    const { data, error } = await supabase.functions.invoke('notify-staff-welcome', { body: { gym_id: gymId, user_id: userId, ...(resend ? { resend: true } : {}) } });
    if (error) return { emailed: false, setPassword: false, reason: await edgeErrorMessage(error, 'The email service did not answer.') };
    const d = (data ?? {}) as { emailed?: boolean; email_error?: string; set_password?: boolean };
    return { emailed: d.emailed === true, setPassword: d.set_password === true, reason: d.emailed === true ? null : d.email_error ?? 'Unknown reason.' };
  } catch (e) {
    return { emailed: false, setPassword: false, reason: e instanceof Error ? e.message : 'The email service did not answer.' };
  }
}

/** What the owner reads after the welcome: whether it went, and what the person has to do. */
export const welcomeNote = (r: WelcomeResult, who: string): string =>
  r.emailed
    ? r.setPassword
      ? `We have emailed ${who} a link to choose their password and sign in to the staff app.`
      : `We have emailed ${who} a welcome with the link to the staff app.`
    : `The welcome email did not go (${r.reason ?? 'unknown reason'}). ${who} can sign in at hybridone.co.uk/login and choose "Forgot password?" to set a password.`;
