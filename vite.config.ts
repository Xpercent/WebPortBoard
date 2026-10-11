import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { existsSync, writeFileSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'

const CONFIG_PATH = fileURLToPath(new URL('./panel.config.json', import.meta.url))
const ENDPOINT = '/__panel/config'
const MAX_BODY = 10 * 1024 * 1024

/**
 * 看板配置存在项目根目录的 panel.config.json，而不是浏览器 localStorage，
 * 这样换浏览器、换机器打开都是同一块看板。
 */
function panelConfigStore(): Plugin {
  return {
    name: 'webapp-panel-config-store',
    configureServer(server) {
      server.middlewares.use(ENDPOINT, (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(existsSync(CONFIG_PATH) ? readFileSync(CONFIG_PATH, 'utf8') : '{"apps":[]}')
          return
        }

        if (req.method === 'PUT') {
          const chunks: Buffer[] = []
          let size = 0
          req.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > MAX_BODY) {
              res.statusCode = 413
              res.end('{"error":"too large"}')
              req.destroy()
              return
            }
            chunks.push(chunk)
          })
          req.on('end', () => {
            if (res.writableEnded) return
            const body = Buffer.concat(chunks).toString('utf8')
            try {
              JSON.parse(body)
            } catch {
              res.statusCode = 400
              res.end('{"error":"invalid json"}')
              return
            }
            writeFileSync(CONFIG_PATH, `${body}\n`)
            res.statusCode = 200
            res.end('{"ok":true}')
          })
          return
        }

        res.statusCode = 405
        res.end('{"error":"method not allowed"}')
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), panelConfigStore()],
  server: {
    port: 5180,
    strictPort: true,
    // 配置文件由中间件读写，不能让它的变更触发整页 reload（那会卸载已打开的应用）
    watch: { ignored: ["**/node_modules/**", "**/.git/**", "**/panel.config.json"] },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
