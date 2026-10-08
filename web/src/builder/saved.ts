import { sanitise, type Spec } from './engine';
import type { Dataset } from './datasets';
import { sanitiseCompare, sanitiseSel, type Compare, type PeriodSel } from './period';

export interface SavedReport { name: string; spec: Spec; period: PeriodSel; compare: Compare }

const key = (gymId: string) => `hybrid-report-builder:${gymId}`;

/** Reports saved on this device for this gym. Anything that no longer makes sense is dropped. */
export function loadSaved(gymId: string, datasets: Dataset[]): SavedReport[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(gymId)) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((x) => {
      const name = x && typeof x === 'object' && typeof (x as { name?: unknown }).name === 'string' ? (x as { name: string }).name : '';
      const spec = name ? sanitise((x as { spec?: unknown }).spec, datasets) : null;
      const r = x as { period?: unknown; compare?: unknown };
      return spec ? [{ name, spec, period: sanitiseSel(r.period), compare: sanitiseCompare(r.compare) }] : [];
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
