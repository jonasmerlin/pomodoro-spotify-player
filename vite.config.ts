import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const useHttps = env.VITE_HTTPS === 'true'
  let httpsOption: { key: Buffer; cert: Buffer } | undefined
  if (useHttps) {
    const keyPath = env.VITE_SSL_KEY
    const certPath = env.VITE_SSL_CERT
    if (keyPath && certPath) {
      const resolvedKey = path.resolve(keyPath)
      const resolvedCert = path.resolve(certPath)
      if (fs.existsSync(resolvedKey) && fs.existsSync(resolvedCert)) {
        httpsOption = {
          key: fs.readFileSync(resolvedKey),
          cert: fs.readFileSync(resolvedCert),
        }
      }
    }
  }

  return {
    plugins: [tailwindcss(), react()],
    server: {
      host: '127.0.0.1',
      ...(httpsOption ? { https: httpsOption } : {}),
      allowedHosts: [
        '127.0.0.1',
        'localhost',
        'c273-87-188-169-218.ngrok-free.app',
      ],
      hmr: {
        host: '127.0.0.1',
      },
    },
  }
})
