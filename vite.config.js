import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Явно указываем порт
    // В Vite все запросы автоматически перенаправляются на index.html для SPA
    proxy: {
      '/api': {
        target: 'https://db.acoustic.ru:3005',
        changeOrigin: true,
        secure: false, // Отключаем проверку SSL для dev режима
        rewrite: (path) => path, // Не перезаписываем путь, оставляем как есть
      },
    },
  },
})
