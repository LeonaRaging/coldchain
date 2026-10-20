import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.HISTORY_API_PROXY

  return {
    plugins: [react(), tailwindcss()],
    server: proxyTarget
      ? {
          proxy: {
            '/stage1': {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
            },
          },
        }
      : undefined,
  }
})
