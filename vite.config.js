import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Для GitHub Pages: используйте имя вашего репозитория
  // Если репозиторий в корне (username.github.io), установите base: '/'
  // Репозиторий: sound_calc
  base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/sound_calc/' : '/'),
  plugins: [react()],
  server: {
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
