import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{spec,test}.{ts,tsx}'],
  },
  resolve: {
    alias: [
      {
        find: /^@deqah\/ui\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/ui/src/$1'),
      },
      {
        find: '@deqah/ui',
        replacement: path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      },
      { find: '@', replacement: path.resolve(__dirname, '.') },
    ],
  },
});
