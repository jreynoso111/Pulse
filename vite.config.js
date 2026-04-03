import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  const deployBase = process.env.VERCEL ? '/' : process.env.GITHUB_ACTIONS ? '/Pulse/' : '/'

  return {
    base: deployBase,
    plugins: [react()],
  }
})
