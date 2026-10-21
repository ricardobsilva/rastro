
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3333' } },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});
