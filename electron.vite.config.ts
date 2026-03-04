import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/main/index.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@main': path.resolve(__dirname, 'src/main'),
        '@renderer': path.resolve(__dirname, 'src/renderer'),
        '@preload': path.resolve(__dirname, 'src/preload')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@renderer': path.resolve(__dirname, 'src/renderer')
      }
    }
  }
})
