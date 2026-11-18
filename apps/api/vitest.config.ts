import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'sqlite::memory:',
      TOKEN_ENCRYPTION_KEY: '0'.repeat(64),
    },
  },
});
