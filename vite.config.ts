import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Serve production API handlers locally; keep assessment credentials on the server. */
function localApi(mode: string): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        const path = url.split('?')[0]
        if (path !== '/api/tts' && path !== '/api/assess' && path !== '/api/dictionary') return next()
        try {
          const mod = (await server.ssrLoadModule(`${path}.ts`)) as {
            default: (req: unknown, res: unknown) => Promise<void>
            handleAssessment?: (req: unknown, res: unknown, config: { apiKey?: string; model?: string }) => Promise<void>
          }
          if (path === '/api/assess' && mod.handleAssessment) {
            // Read the file on every assessment request. A newly added or rotated
            // key takes effect without copying stale file values into process.env.
            const env = loadEnv(mode, server.config.envDir, 'OPENAI_')
            await mod.handleAssessment(req, res, { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_ASSESS_MODEL })
          } else await mod.default(req, res)
        } catch (error) { next(error) }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), localApi(mode)],
    server: { port: Number(process.env.PORT) || 5174 },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const norm = id.replace(/\\/g, '/')
            if (norm.includes('/node_modules/react/') || norm.includes('/node_modules/react-dom/')) {
              return 'vendor-react'
            }
            if (norm.includes('/node_modules/@supabase/')) {
              return 'vendor-supabase'
            }
            if (norm.includes('/node_modules/hanzi-writer')) {
              return 'vendor-hanzi'
            }
            if (
              norm.includes('/src/data/hsk4a') ||
              norm.includes('/src/data/teach/') ||
              norm.includes('/src/data/jiayin-audio')
            ) {
              return 'data-hsk'
            }
            if (norm.includes('/src/data/i18n/') || norm.includes('/src/i18n/')) {
              return 'data-i18n'
            }
          },
        },
      },
    },
  }
})
