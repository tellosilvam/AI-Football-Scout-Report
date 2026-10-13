import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  test: {
    include: ['evals/**/*.eval.ts'],
    env: loadEnv(mode, process.cwd(), ''),
    sequence: { concurrent: false },
    testTimeout: 120_000,
  },
}));
