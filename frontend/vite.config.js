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
    port: 5173,
  },
})
