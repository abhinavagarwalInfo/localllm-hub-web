import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // ← Listen on all interfaces
    port: 5173,
    strictPort: true,

    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    },
    cors: true,
  },
  build: {
    outDir: 'dist',
    //emptyOutDir: true
  }
});