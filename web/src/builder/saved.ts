import { sanitise, type Spec } from './engine';
import type { Dataset } from './datasets';

export interface SavedReport { name: string; spec: Spec }

const key = (gymId: string) => `hybrid-report-builder:${gymId}`;

/** Reports saved on this device for this gym. Anything that no longer makes sense is dropped. */
export function loadSaved(gymId: string, datasets: Dataset[]): SavedReport[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(gymId)) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((x) => {
      const name = x && typeof x === 'object' && typeof (x as { name?: unknown }).name === 'string' ? (x as { name: string }).name : '';
      const spec = name ? sanitise((x as { spec?: unknown }).spec, datasets) : null;
      return spec ? [{ name, spec }] : [];
    });
  } catch {
    return [];
  }
}

export function storeSaved(gymId: string, list: SavedReport[]): void {
  try {
    localStorage.setItem(key(gymId), JSON.stringify(list));
  } catch {
    /* saving on this device is a convenience; the report still works without it */
  }
}
