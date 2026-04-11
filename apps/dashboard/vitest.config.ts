import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{spec,test}.{ts,tsx}'],
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    coverage: {
      provider: 'v8',
      include: [
        'lib/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
      ],
      exclude: [
        'node_modules',
        '**/*.{spec,test}.{ts,tsx}',
        '**/*.d.ts',
        'next.config.*',
        'tailwind.config.*',
        'postcss.config.*',
      ],
      thresholds: {
        branches: 10,
        functions: 22,
        lines: 15,
        statements: 20,
      },
      reporter: ['text', 'lcov', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
