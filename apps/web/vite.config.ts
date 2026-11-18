import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Em desenvolvimento, /api vai para a API Express (evita CORS e URLs fixas no front).
    proxy: { '/api': 'http://localhost:3333' },
  },
});
