import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.mts'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        'tests/helpers/**',
        '*.config.*',
        '**/*.d.ts',
      ],
    },
  },
})
