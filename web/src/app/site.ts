/** Where the site lives. '/' on hybridone.co.uk; '/HybridOS/' on the dev preview (a GitHub Pages sub-path). Set at build time. */
export const SITE: string = import.meta.env.VITE_SITE_ROOT ?? '/';

/** The router prefix: the site root without its trailing slash ('' on live). */
export const BASENAME = SITE.replace(/\/$/, '');

/** Address of a file or old page at the site root, e.g. siteUrl('login.html'). Works from any screen depth. */
export function siteUrl(path: string): string {
  return `${SITE}${path.replace(/^\/+/, '')}`;
}
