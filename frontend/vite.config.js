import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const API_TARGET =
    env.VITE_API_ORIGIN?.replace(/\/$/, '') ||
    'https://dev3.constrtodo.ru:3005'
  /** Куда проксировать только GET превью /api/v1/constr/* (JSON и расчёт идут на API_TARGET) */
  const CONSTR_PROXY_TARGET =
    env.VITE_CONSTR_IMAGES_ORIGIN?.replace(/\/$/, '') || API_TARGET

  const setProxyOriginHeaders = (proxyReq, targetBase) => {
    proxyReq.setHeader('origin', targetBase)
    proxyReq.setHeader('referer', `${targetBase}/`)
  }

  const constrPublicDir = join(process.cwd(), 'public', 'api', 'v1', 'constr')

  return {
  // Base path для GitHub Pages
  // Если репозиторий называется username.github.io, установите base: '/'
  // Для остальных репозиториев путь будет /repository-name/
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    // Плагин для копирования index.html в 404.html (для GitHub Pages SPA routing)
    // GitHub Pages будет использовать 404.html для всех несуществующих путей
    // React Router на клиенте обработает маршрут
    {
      name: 'copy-404',
      closeBundle() {
        const distPath = join(process.cwd(), 'dist')
        const distIndexPath = join(distPath, 'index.html')
        const dist404Path = join(distPath, '404.html')
        try {
          // Просто копируем index.html в 404.html
          // Это стандартный подход для SPA на GitHub Pages
          copyFileSync(distIndexPath, dist404Path)
        } catch (error) {
          console.warn('Could not copy index.html to 404.html:', error.message)
        }
      }
    }
  ],
  server: {
    port: 5173, // Явно указываем порт
    // В Vite все запросы автоматически перенаправляются на index.html для SPA
    proxy: {
      // Должно быть выше «/api», иначе превью уйдут на API_TARGET без учёта VITE_CONSTR_IMAGES_ORIGIN
      '/api/v1/constr': {
        target: CONSTR_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
        bypass(req) {
          if (req.method !== 'GET' && req.method !== 'HEAD') return
          const raw = req.url || ''
          const pathname = raw.split('?')[0] || ''
          if (!pathname.startsWith('/api/v1/constr/')) return
          const name = decodeURIComponent(pathname.slice('/api/v1/constr/'.length))
          if (!name || name.includes('..') || name.includes('/') || name.includes('\\'))
            return
          const fp = join(constrPublicDir, name)
          if (existsSync(fp)) return raw
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            setProxyOriginHeaders(proxyReq, CONSTR_PROXY_TARGET)
          })
        },
      },
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false, // Отключаем проверку SSL для dev режима
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Сохраняем путь /api
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            setProxyOriginHeaders(proxyReq, API_TARGET)
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
          });
        },
      },
    },
  },
  }
})
