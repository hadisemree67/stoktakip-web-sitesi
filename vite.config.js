import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Yerel ağdaki diğer cihazların (telefon, tablet vb.) erişebilmesini sağlar
    port: 5173,
  },
})

