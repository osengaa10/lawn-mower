import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works under https://<user>.github.io/<repo>/
  base: './',
  server: { port: 4000, strictPort: true, host: true },
  preview: { port: 4000, strictPort: true, host: true },
});
