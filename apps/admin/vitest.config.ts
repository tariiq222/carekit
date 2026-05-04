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
    coverage: {
      provider: 'v8',
      all: true,
      include: [
        'features/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
        'shell/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.d.ts',
        '**/types.ts',
        '**/index.ts',
        '**/*.config.{ts,js,mjs}',
        'app/**/layout.tsx',
        'app/**/loading.tsx',
        'app/**/error.tsx',
        'app/**/not-found.tsx',
      ],
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: 'coverage/unit',
    },
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
