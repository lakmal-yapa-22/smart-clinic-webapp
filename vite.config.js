import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      '/api/patients': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/appointments': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/billings': {
        target: 'http://localhost:8083',
        changeOrigin: true,
      },
    }
  },
  preview: {
    port: 4173,
  }
});
