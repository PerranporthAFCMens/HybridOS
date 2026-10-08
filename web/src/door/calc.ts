// Pure rules behind Door access: the PIN members can reveal in their member view.

export const DEFAULT_LABEL = 'Door access';

export interface DoorForm { enabled: boolean; code: string; label: string; note: string }
export const emptyDoorForm: DoorForm = { enabled: false, code: '', label: DEFAULT_LABEL, note: '' };

export interface DoorSaved { enabled: boolean; code: string | null; label: string; note: string | null }

export function formFromSaved(s: DoorSaved | null): DoorForm {
  return s ? { enabled: s.enabled, code: s.code ?? '', label: s.label || DEFAULT_LABEL, note: s.note ?? '' } : emptyDoorForm;
}

export type DoorCheck = { ok: true; value: DoorSaved } | { ok: false; message: string };

export function validateDoor(f: DoorForm): DoorCheck {
  const code = f.code.trim();
  if (f.enabled && !code) return { ok: false, message: 'Enter an access code before showing door access to members.' };
  if (code.length > 12) return { ok: false, message: 'The access code can be up to 12 characters.' };
  if (f.label.trim().length > 40) return { ok: false, message: 'The label can be up to 40 characters.' };
  if (f.note.trim().length > 200) return { ok: false, message: 'The note can be up to 200 characters.' };
  return { ok: true, value: { enabled: f.enabled, code: code || null, label: f.label.trim() || DEFAULT_LABEL, note: f.note.trim() || null } };
}

/** What a member will see, for the preview. The code is only shown when door access is switched on. */
export function previewOf(f: DoorForm): { label: string; code: string; note: string; visible: boolean } {
  return { label: f.label.trim() || DEFAULT_LABEL, code: f.code.trim() || '••••', note: f.note.trim() || 'No note set.', visible: f.enabled };
}

export const sameAsSaved = (f: DoorForm, s: DoorSaved | null): boolean => {
  const c = validateDoor(f);
  const base = s ?? { enabled: false, code: null, label: DEFAULT_LABEL, note: null };
  return c.ok && c.value.enabled === base.enabled && c.value.code === base.code && c.value.label === (base.label || DEFAULT_LABEL) && c.value.note === base.note;
};
