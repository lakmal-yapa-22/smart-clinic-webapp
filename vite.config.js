import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Backend request එක '/api' වලින් පටන් ගන්නවා නම් මේක වැඩ කරනවා
      '/api': {
        target: 'http://35.187.225.225',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 5173,
  }
});