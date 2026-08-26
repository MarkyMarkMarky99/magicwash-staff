import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    vue()
  ],
  server: {
    // Pin the dev port. strictPort makes Vite exit with "Port 3102 is already in use"
    // instead of silently moving on to 3103, 3104, ... A silent hop leaves the old
    // server running, so you end up with several stale dev servers at once — we found
    // five of them listening after one overnight session.
    // If this fails to start: something is already listening. Kill it, don't take a
    // new port.
    port: 3102,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@contracts': fileURLToPath(new URL('./contracts', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
})
