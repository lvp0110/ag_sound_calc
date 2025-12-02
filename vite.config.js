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
    // Плагин для копирования 404.html в dist (для GitHub Pages SPA routing)
    {
      name: 'copy-404',
      closeBundle() {
        const distPath = join(process.cwd(), 'dist')
        const public404Path = join(process.cwd(), 'public', '404.html')
        const dist404Path = join(distPath, '404.html')
        const distIndexPath = join(distPath, 'index.html')
        try {
          // Копируем 404.html из public
          copyFileSync(public404Path, dist404Path)
          console.log('✓ Copied 404.html to dist')
        } catch (error) {
          // Если 404.html не найден, копируем index.html как 404.html
          try {
            copyFileSync(distIndexPath, dist404Path)
            console.log('✓ Copied index.html to 404.html as fallback')
          } catch (fallbackError) {
            console.warn('Could not copy 404.html:', error.message)
          }
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
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
})
