import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Serve production API handlers locally. */
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        const path = url.split('?')[0]
        if (path !== '/api/tts' && path !== '/api/dictionary') return next()
        try {
          const mod = (await server.ssrLoadModule(`${path}.ts`)) as { default: (req: unknown, res: unknown) => Promise<void> }
          await mod.default(req, res)
        } catch (error) { next(error) }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
  server: { port: Number(process.env.PORT) || 5174 },
})
