import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/vocab-trainer/', // change if your repo name differs
  plugins: [react()],
})
