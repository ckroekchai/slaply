import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
 plugins: [react()],
 server: {
  host: '127.0.0.1', port: 5175, strictPort: true,
  proxy: {
   '/api': {
    target: 'http://127.0.0.1:8788', changeOrigin: true,
    configure(proxy) {
     proxy.on('proxyReq', (proxyReq, request) => {
      // Keep production origin checks strict. Only translate the two local UI
      // origins to the explicitly configured local Worker origin during dev.
      if (['http://127.0.0.1:5175', 'http://localhost:5175'].includes(request.headers.origin)) {
       proxyReq.setHeader('Origin', 'http://127.0.0.1:8788');
      }
     });
    },
   },
  },
 },
 build: { outDir: 'dist', sourcemap: false }
});
