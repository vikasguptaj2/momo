import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts') } } }
  },
  preload: {
    // The sandboxed preload must remain a single CommonJS bundle.
    build: { externalizeDeps: false, rollupOptions: { input: { index: resolve('src/preload/index.ts') } } }
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [react({})],
    resolve: { alias: { '@': resolve('src/renderer') } },
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html'), companion: resolve('src/renderer/companion.html') } } }
  }
});
