import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./frontend/tests",
    outputDir: ".tmp/test-results",
    // e2e-usuario.spec.js é excluído do run normal (CI).
    // Execute manualmente: npm run test:usuario:headed
    testIgnore: ["**/e2e-usuario.spec.js"],
    timeout: 30_000,
    retries: 1,
    reporter: [
        ["html", { outputFolder: ".tmp/playwright-report", open: "never" }],
        ["json", { outputFile: "tests/results/playwright_results.json" }],
        ["line"],
    ],
    globalSetup: "./frontend/tests/setup/global-setup.js",
    use: {
        baseURL: "http://localhost:8888",
        headless: true,
        screenshot: "only-on-failure",
        video: "off",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});
