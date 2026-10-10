import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Built to _site/next/ by scripts/build_site.py. The folder name is internal: people see clean addresses (/today, /join/<gym>),
// which the server (Vercel rewrites; a 404 fallback page on the GitHub Pages dev preview) hands to this app.
// VITE_SITE_ROOT is where the site lives: '/' live, '/HybridOS/' on the dev preview.
declare const process: { env: Record<string, string | undefined> };
const site = process.env.VITE_SITE_ROOT || '/';
export default defineConfig({
  base: `${site}next/`,
  define: { 'import.meta.env.VITE_SITE_ROOT': JSON.stringify(site) },
  plugins: [react(), { name: 'site-root', transformIndexHtml: (html: string) => html.replaceAll('__SITE__', site) }],
  // The signed-copy edge function (supabase/functions/finalise-signature) imports its PDF library the way Deno does; tests run it with the npm copy.
  resolve: {
    alias: [
      { find: /^npm:pdf-lib@.*$/, replacement: new URL('./node_modules/pdf-lib', import.meta.url).pathname },
      { find: /^jsr:@supabase\/supabase-js@.*$/, replacement: new URL('./node_modules/@supabase/supabase-js', import.meta.url).pathname },
    ],
  },
  build: { outDir: '../_site/next', emptyOutDir: true, sourcemap: false },
  // The live pages one folder up are read as text by tests/classic-pages.test.ts, so the dev server may read them.
  server: { fs: { allow: ['..'] } },
  test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'] },
});
