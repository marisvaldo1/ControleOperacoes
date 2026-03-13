/**
 * playwright.usuario.config.js
 * Configuração específica para testes E2E de simulação de usuário.
 *
 * ► Com browser visível (para acompanhar):
 *     npx playwright test --config=playwright.usuario.config.js --headed --slow-mo=700
 *
 * ► Sem interface (headless):
 *     npx playwright test --config=playwright.usuario.config.js
 *
 * ► Via npm scripts:
 *     npm run test:usuario
 *     npm run test:usuario:headed
 *     npm run test:usuario:watch
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir:  "./frontend/tests",
    testMatch: ["**/e2e-usuario.spec.js"],
    outputDir: ".tmp/test-results-usuario",
    timeout: 60_000,   // mais generoso para slow-mo
    retries: 0,
    reporter: [
        ["html",  { outputFolder: ".tmp/playwright-report-usuario", open: "never" }],
        ["line"],
        ["json",  { outputFile: "tests/results/e2e_raw.json" }],
    ],
    globalSetup: "./frontend/tests/setup/global-setup.js",
    use: {
        baseURL:    "http://localhost:8888",
        headless:   !(process.env.PW_HEADED === '1'),
        slowMo:     parseInt(process.env.PW_SLOW_MO || '0'),
        screenshot: process.env.PW_SCREENSHOTS === 'always' ? 'on' :
                    process.env.PW_SCREENSHOTS === 'never'  ? 'off' : 'only-on-failure',
        video:      "off",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});
