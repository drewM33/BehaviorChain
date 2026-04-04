import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'fs';

// IDKit's WASM binary is loaded via `new URL("idkit_wasm_bg.wasm", import.meta.url)`.
// When Vite pre-bundles idkit-core, the resulting URL points inside .vite/deps/
// but Vite doesn't copy the .wasm file there. This middleware intercepts that
// request and serves the real binary from node_modules.
function serveIdkitWasm(): import('vite').Plugin {
  return {
    name: 'serve-idkit-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('/idkit_wasm_bg.wasm')) {
          const wasmPath = resolve(
            __dirname,
            'node_modules/@worldcoin/idkit-core/dist/idkit_wasm_bg.wasm',
          );
          if (existsSync(wasmPath)) {
            const { readFileSync } = require('fs');
            const buf = readFileSync(wasmPath);
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Content-Length', buf.byteLength);
            res.end(buf);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [react(), serveIdkitWasm()],
  envDir: resolve(__dirname, '../..'),
  define: {
    'process.env': {},
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
