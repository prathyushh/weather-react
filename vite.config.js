import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies API calls to the Spring Boot backend, so no CORS setup or backend change is needed.
const target = process.env.BACKEND || 'http://localhost:8080';
export default defineConfig({
  plugins: [react()],
  server: { port: 3000, proxy: { '/auth': target, '/api': target } },
});
