import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Serves the same /api/tts neural voice locally that Vercel serves in production. */
function localTts(): Plugin {
  return {
    name: 'local-tts',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/tts')) return next()
        const mod = (await server.ssrLoadModule('/api/tts.ts')) as { default: (req: unknown, res: unknown) => Promise<void> }
        await mod.default(req, res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localTts()],
  server: { port: Number(process.env.PORT) || 5174 },
})
