import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
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
