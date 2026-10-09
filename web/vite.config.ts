import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Built to _site/next/ by scripts/build_site.py. A relative base plus hash
// routing lets one build run on GitHub Pages (dev) and Vercel (live).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: '../_site/next', emptyOutDir: true, sourcemap: false },
  // The live pages one folder up are read as text by tests/classic-pages.test.ts, so the dev server may read them.
  server: { fs: { allow: ['..'] } },
  test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'] },
});
