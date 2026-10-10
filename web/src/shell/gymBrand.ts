import { siteUrl } from '../app/site';
// Which logo the sidebar shows for a gym. Same rule as the old tenant-branding.js:
// an uploaded logo wins; Hybrid Hub falls back to its bundled logo; other gyms show the name only.
const HYBRID_HUB_ID = '242f57c2-6e37-4977-b3c5-1c87de7d0b98';
const HYBRID_HUB_LOGO = siteUrl('assets/hybrid-hub-logo-horizontal.svg');

export interface GymLogo {
  src: string;
  /** Uploaded by the gym (shown on a light pad), as opposed to a bundled white-on-dark logo. */
  uploaded: boolean;
}

export function gymLogo(gymId: string, logoUrl: string | null): GymLogo | null {
  if (logoUrl && /^https?:/i.test(logoUrl)) return { src: logoUrl, uploaded: true };
  if (gymId === HYBRID_HUB_ID) return { src: HYBRID_HUB_LOGO, uploaded: false };
  return null;
}
