import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,

    pwaAssets: {
      disabled: false,
      config: true,
    },

    manifest: {
      name: 'Dell AI PC Chat',
      short_name: 'Dell AI PC Chat',
      description: 'Chat Template for Dell AI Framework',
      theme_color: '#0D2155',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      categories: ['productivity', 'business'],
      start_url: '/',
      scope: '/',
    },

    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,ttf,eot,pdf,json,mjs}', 'offline.html'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
      
      // Runtime caching strategies
      runtimeCaching: [
        // Cache images
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'images-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            },
          },
        },
        // Cache fonts
        {
          urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'fonts-cache',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
            },
          },
        },
        // Cache API calls to Dell AI Framework (local OpenAI server)
        {
          urlPattern: /^http:\/\/localhost:\d+\/v1\/.*/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'ai-api-cache',
            networkTimeoutSeconds: 30,
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60, // 1 hour
            },
          },
        },
        // Cache API calls to local backend (except vector DB endpoints)
        {
          urlPattern: ({ url }) => {
            const path = url.pathname;
            return url.hostname === 'localhost' && 
                   !path.includes('/vector-stores') && 
                   !path.includes('/collections') && 
                   !path.includes('/search');
          },
          handler: 'NetworkFirst',
          options: {
            cacheName: 'backend-api-cache',
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 30 * 60, // 30 minutes
            },
          },
        },
        // Network-only for vector DB endpoints (company chat)
        {
          urlPattern: ({ url }) => {
            const path = url.pathname;
            return path.includes('/vector-stores') || 
                   path.includes('/collections') || 
                   path.includes('/search');
          },
          handler: 'NetworkOnly',
          options: {},
        },
        // Cache PDF files
        {
          urlPattern: /\.pdf$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'pdf-cache',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
            },
          },
        },
        // Default handler for other requests
        {
          urlPattern: /^https?\:\/\/.*/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'default-cache',
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 24 * 60 * 60, // 1 day
            },
          },
        },
      ],
      
      // Navigation fallback for SPA
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/__/, /\/[^/?]+\.[^/]+$/],
    },

    devOptions: {
      enabled: true,
      navigateFallback: 'index.html',
      suppressWarnings: true,
      type: 'module',
    },
  })],
  
  // Add optimizeDeps configuration for PDF.js
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  
  // Add build options to properly handle worker files
  build: {
    commonjsOptions: {
      include: [/node_modules/]
    },
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
      external: [
        'chromadb-default-embed',
        '@xenova/transformers',
        '@zilliz/milvus2-sdk-node',
        '@qdrant/js-client-rest'
      ]
    }
  },
  
  // Add resolve alias to ensure worker is found correctly
  resolve: {
    alias: {
      'pdfjs-dist': resolve(__dirname, './node_modules/pdfjs-dist/build/pdf.mjs')
    }
  },

  // Add this to use your custom template
  server: {
    fs: {
      allow: ['..']
    }
  },
  
  // Define global variables for browser environment
  define: {
    // Polyfill for process.env needed by pg library
    'process.env': {},
    'process.version': '"v16.0.0"',
    'process.platform': '"browser"',
    global: 'window'
  }
})