import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'test' ? [] : [mkcert()])],
  server: {
    https: mode === 'test' ? undefined : {},
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist' },
}));
