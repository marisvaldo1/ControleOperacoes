import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./frontend/tests",
    outputDir: ".tmp/test-results",
    timeout: 20_000,
    retries: 0,
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
