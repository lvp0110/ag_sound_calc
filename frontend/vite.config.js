import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'fs'
import { join } from 'path'

// https://vite.dev/config/
export default defineConfig({
  // Base path для GitHub Pages: для username.github.io = '/', иначе /repository-name/
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    // Копируем index.html в 404.html — стандартный SPA-роутинг для GitHub Pages
    {
      name: 'copy-404',
      closeBundle() {
        const distPath = join(process.cwd(), 'dist')
        try {
          copyFileSync(join(distPath, 'index.html'), join(distPath, '404.html'))
        } catch (error) {
          console.warn('Could not copy index.html to 404.html:', error.message)
        }
      },
    },
  ],
  server: {
    // host: true → vite слушает 0.0.0.0 (нужно при запуске в docker-контейнере,
    // чтобы порт был доступен с хоста; локально на работу не влияет).
    host: true,
    port: 5173,
    // В docker bind-mount на macOS file-watching не ловит изменения без polling.
    // Включается через CHOKIDAR_USEPOLLING=true (см. docker-compose.yml).
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
    },
    proxy: {
      // Логотипы и прочие пользовательские загрузки лежат на backend (Express.static),
      // фронт получает относительные URL вида `/uploads/<filename>`. В dev vite иначе
      // ловит их своим SPA-фолбэком и отдаёт index.html — поэтому проксируем на backend.
      // (Запросы `/api/*` идут с явным `http://localhost:3006` через apiClient, см. DEFAULT_BASE_URL.)
      // BACKEND_PROXY_TARGET переопределяется в docker (host.docker.internal:3006),
      // т.к. внутри контейнера localhost — это сам контейнер, а не хостовый backend.
      '/uploads': {
        target: process.env.BACKEND_PROXY_TARGET || 'http://localhost:3006',
        changeOrigin: true,
      },
    },
  },
})
