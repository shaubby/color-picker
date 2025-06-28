import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer', // your React app folder
  base: './', // ← this is important for Electron
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});