/** HybridOne Control: what the screens show, worked out from what the database returns. No network here. */

export interface Addon { key: string; name: string; description: string; optional: boolean; defaultOn: boolean }
export interface ControlGym { gymId: string; name: string; slug: string; createdAt: string; members: number; ownerEmail: string; addonsOff: string[] }
export interface AuditEntry { id: number; at: string; actor: string; action: string; gymId: string; detail: Record<string, unknown> }

export interface AddonState extends Addon { on: boolean; locked: boolean }

/** Each add-on with whether it is on for this gym. Always-on modules are locked and cannot be switched off. */
export function addonStates(catalogue: Addon[], gym: Pick<ControlGym, 'addonsOff'>): AddonState[] {
  return catalogue.map((a) => ({ ...a, on: !gym.addonsOff.includes(a.key), locked: !a.optional }));
}

export function offCount(catalogue: Addon[], gym: Pick<ControlGym, 'addonsOff'>): number {
  return addonStates(catalogue, gym).filter((a) => !a.on).length;
}

/** "Community off" style summary for the gym list. */
export function offSummary(catalogue: Addon[], gym: Pick<ControlGym, 'addonsOff'>): string {
  const names = addonStates(catalogue, gym).filter((a) => !a.on).map((a) => a.name);
  return names.length === 0 ? 'Everything on' : `Off: ${names.join(', ')}`;
}

/** One plain sentence for the audit log. */
export function auditLine(e: AuditEntry, gymNames: Map<string, string>, addonNames: Map<string, string>): string {
  const gym = gymNames.get(e.gymId) ?? 'a gym';
  if (e.action === 'set_gym_addon') {
    const key = String(e.detail.addon ?? '');
    const name = addonNames.get(key) ?? key;
    return `${name} switched ${e.detail.enabled === true ? 'on' : 'off'} for ${gym}`;
  }
  return `${e.action.replace(/_/g, ' ')} (${gym})`;
}

/** Newest first, by the log's own number. */
export function newestFirst(entries: AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => b.id - a.id);
}
