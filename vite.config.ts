import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      // Optional native-only Capacitor plugins, dynamically imported in
      // src/lib/mobile.ts and only ever resolved at runtime once the app is
      // built as a native app with those packages actually installed. They
      // aren't real web dependencies, so Rollup must not try to resolve them.
      external: [
        '@capacitor/browser',
        '@capacitor/preferences',
        '@capacitor-community/contacts',
      ],
    },
  },
});
