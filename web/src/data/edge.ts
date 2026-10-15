/**
 * The readable message from a failed Edge Function call (the real reason is in the response body, not in `error.message`).
 * The function also sends a `stage` (an internal label such as "context" for where it stopped). That is for the function's own logs, not for the
 * person reading the screen, so it is left off.
 */
export async function edgeErrorMessage(error: { message: string }, fallback: string): Promise<string> {
  let message = error.message;
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      const j = (await ctx.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      /* keep the generic message */
    }
  }
  return message || fallback;
}
