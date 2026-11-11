import { defineConfig, devices } from '@playwright/test';

import baseConfig from './playwright.config';

/**
 * Capturas de tela do README (`npm run screenshots`): a mesma build de demo e o mesmo relógio
 * fixo dos E2E, então as imagens saem iguais a cada execução e só mostram dados fictícios do seed.
 * As imagens vão para `docs/images/`; rode de novo quando uma tela mostrada mudar.
 */
export default defineConfig({
  ...baseConfig,
  testMatch: /\.screenshots\.ts$/,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  // Sem animações: com o relógio fixo, as dos gráficos não avançariam.
  use: { ...baseConfig.use, trace: 'off', screenshot: 'off', reducedMotion: 'reduce' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      grepInvert: /celular/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], deviceScaleFactor: 2 }, grep: /celular/ },
  ],
});
