import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Минификация с terser для меньшего бандла
    minify: 'esbuild',
    // Убираем source maps в продакшне
    sourcemap: false,
    // Предупреждение если чанк > 500KB
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        // Vendor (React) отдельно — кэшируется навсегда, меняется редко
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
        // Content-hash в именах файлов — правильный cache-busting
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash][extname]',
      },
    },
  },
})
