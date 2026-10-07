// Same keys as the legacy gym-context.js so both apps agree on the selected gym.
const SESSION_KEY = 'hybrid-gym-id';
const LAST_KEY = 'hybrid-last-gym-id';

export function getSelectedGymId(): string {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setSelectedGymId(id: string): void {
  if (!id) return;
  try {
    sessionStorage.setItem(SESSION_KEY, id);
    localStorage.setItem(LAST_KEY, id); // convenience hint only, never permission
  } catch {
    /* storage unavailable */
  }
}

export function clearSelectedGymId(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}
