import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Serveur API utilisé par « npm run dev » : le backend local (docker compose, port 3001).
// Pour développer contre le serveur de production :
//   PowerShell : $env:API_PROXY="http://51.38.129.2:3001"; npm run dev
const API_PROXY = process.env.API_PROXY || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': API_PROXY,
    },
  },
})
