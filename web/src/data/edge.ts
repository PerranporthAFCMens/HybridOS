/** The readable message from a failed Edge Function call (the real reason is in the response body, not in `error.message`). */
export async function edgeErrorMessage(error: { message: string }, fallback: string): Promise<string> {
  let message = error.message;
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      const j = (await ctx.json()) as { error?: string; stage?: string };
      if (j.error) message = j.stage ? `${j.stage}: ${j.error}` : j.error;
    } catch {
      /* keep the generic message */
    }
  }
  return message || fallback;
}
