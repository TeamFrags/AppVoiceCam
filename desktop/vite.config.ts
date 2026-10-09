import { defineConfig } from 'vite';

export default defineConfig({
  // Tauri expects a fixed port and reports Rust errors itself.
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
});
