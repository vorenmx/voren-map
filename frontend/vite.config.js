import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  server: {
    headers: {
      // Lets Firebase Google sign-in popup communicate with the opener (avoids COOP console noise).
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  // `npm run preview` (e.g. :4174) does not use `server`; it needs the same header for Google popup auth.
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  optimizeDeps: {
    exclude: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'firebase/analytics',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'deck-gl': [
            '@deck.gl/core',
            '@deck.gl/layers',
            '@deck.gl/aggregation-layers',
            '@deck.gl/google-maps',
          ],
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
  },
});
