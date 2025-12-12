import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { join } from 'path'

// https://vite.dev/config/
export default defineConfig({
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
      '/api': {
        target: 'https://db.acoustic.ru:3005',
        changeOrigin: true,
        secure: false, // Отключаем проверку SSL для dev режима
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Сохраняем путь /api
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
          });
        },
      },
    },
  },
})
