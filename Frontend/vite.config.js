import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@heroicons/react/24/outline': fileURLToPath(new URL('./src/icons/heroicons.jsx', import.meta.url)),
      '@heroicons/react/24/solid': fileURLToPath(new URL('./src/icons/heroicons.jsx', import.meta.url)),
    },
  },
server: {
  port: 5173,
  host: '0.0.0.0',
  strictPort: true,
  cors: true,
  allowedHosts: true,
  proxy: {
    '/api': {
      target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
      changeOrigin: true,
    },
  },
  
  }
});
