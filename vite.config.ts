import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'development-refresh-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      // React Refresh injects a module preamble only in the development server.
      return html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
    },
  }],
  server: { host: 'localhost', port: 5173, strictPort: true },
})
