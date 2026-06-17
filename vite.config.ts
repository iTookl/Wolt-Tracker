import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: vite-plugin-pwa подключим на финальном (PWA) этапе по плану.
export default defineConfig({
  plugins: [react()],
});
