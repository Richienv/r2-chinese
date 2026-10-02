import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Serves the same /api/tts neural voice locally that Vercel serves in production. */
function localTts(): Plugin {
  return {
    name: 'local-tts',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        const path = url.split('?')[0]
        if (path !== '/api/tts' && path !== '/api/assess' && path !== '/api/dictionary') return next()
        const mod = (await server.ssrLoadModule(`${path}.ts`)) as { default: (req: unknown, res: unknown) => Promise<void> }
        await mod.default(req, res)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), 'OPENAI_')
  // Explicit server-only allowlist. Never expose secrets through import.meta.env.
  for (const key of ['OPENAI_API_KEY', 'OPENAI_ASSESS_MODEL']) {
    if (!process.env[key] && serverEnv[key]) process.env[key] = serverEnv[key]
  }
  return {
    plugins: [react(), localTts()],
    server: { port: Number(process.env.PORT) || 5174 },
  }
})
