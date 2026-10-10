import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Built to _site/next/ by scripts/build_site.py. A relative base plus hash
// routing lets one build run on GitHub Pages (dev) and Vercel (live).
export default defineConfig({
  base: './',
  plugins: [react()],
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
