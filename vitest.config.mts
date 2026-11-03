import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/{unit,integration}/**/*.spec.ts'],
    env: { TZ: 'UTC' },
  },
})
