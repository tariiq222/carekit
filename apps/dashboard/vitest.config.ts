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
    // Pre-existing exclusion. See follow-up bug (file currently fails in
    // isolation); revisit once the hook's mock setup is stabilized.
    exclude: ['test/unit/hooks/use-employees.spec.tsx'],
    // Forks pool — one worker per test file, each with its own Node heap.
    // Prevents the heap-out-of-memory failure seen when all 149 dashboard
    // specs were forced into a single fork (TAR-18). Do NOT re-introduce
    // poolOptions.forks.singleFork: true; it accumulates jsdom + RTL +
    // vi.resetModules() state until the ~4GB heap is exhausted.
    pool: 'forks',
    // Cap concurrent forks so CI runners with many cores (e.g. 8-vCPU
    // GitHub-hosted runners) do not spawn 8+ jsdom processes in parallel
    // and exceed the runner's memory budget. Two workers keeps total peak
    // memory under ~1.5 GB while still parallelising across files.
    maxWorkers: 2,
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
