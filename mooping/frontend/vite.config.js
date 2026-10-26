import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// El backend corre en :8000 (docker compose). En dev, /api se proxyea ahí;
// en Docker, BACKEND_URL apunta al servicio `backend`.
const backend = process.env.BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    host: true,
    port: 5173,
    // Sin changeOrigin: Django recibe Host "localhost", que está en DJANGO_ALLOWED_HOSTS
    // ("backend" no lo está).
    proxy: { '/api': { target: backend } },
    // En Docker sobre Windows los cambios de archivos no llegan como eventos:
    // sin polling, Vite sigue sirviendo la versión vieja.
    watch: process.env.VITE_WATCH_POLLING === 'true' ? { usePolling: true, interval: 500 } : undefined,
  },
})
