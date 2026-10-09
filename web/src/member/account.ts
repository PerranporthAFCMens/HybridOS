// Rules for the member's own account details. Kept here so they are tested without a screen.

export const MIN_PASSWORD = 8;

export function checkName(display: string, first: string, last: string): string | null {
  const d = display.trim();
  if (!d) return 'Add the name you want to be shown as.';
  if (d.length > 120 || first.trim().length > 60 || last.trim().length > 60) return 'That name is too long.';
  return null;
}

export function checkEmail(next: string, current: string): string | null {
  const e = next.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Enter a valid email address.';
  if (e.toLowerCase() === current.trim().toLowerCase()) return 'That is already your email address.';
  return null;
}

export function checkPassword(a: string, b: string): string | null {
  if (a.length < MIN_PASSWORD) return `Your new password must be at least ${MIN_PASSWORD} characters.`;
  if (a !== b) return 'The two passwords do not match.';
  return null;
}
