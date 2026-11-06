import { defineConfig, devices } from '@playwright/test';

const PORT = 4301;
const API_PORT = 3334;
const isCI = !!process.env['CI'];
/** Pasta do repositório da API; por padrão, ao lado deste repositório. */
const API_DIR = process.env['API_DIR'] ?? '../gestao-financeira-api';

/**
 * Testes E2E contra a API real (`npm run e2e:api`). Sobe uma instância própria da API (porta 3334,
 * sem limite de tentativas) e o front na configuração `api`, com o proxy apontando para ela. O
 * banco é o do `.env` da API, com migrações aplicadas e a conta de demonstração criada
 * (`npm run db:migrate` e `npm run db:seed` no repositório da API).
 */
export default defineConfig({
  testDir: './e2e-api',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-api' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-api' }]],
  outputDir: 'test-results-api',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'api', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node --env-file-if-exists=.env src/server.ts',
      cwd: API_DIR,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      // Variáveis do ambiente têm precedência sobre o `.env` da API.
      env: { PORT: String(API_PORT), RATE_LIMIT_ENABLED: 'false', LOG_LEVEL: 'warn' },
    },
    {
      command: `npx ng serve -c api --port ${PORT} --proxy-config proxy.e2e.conf.json`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  ],
});
