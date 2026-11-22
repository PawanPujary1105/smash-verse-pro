import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/smash-verse-pro/',
  build: {
    outDir: 'docs',
  },
  plugins: [react()],
})
