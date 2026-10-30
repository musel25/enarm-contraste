import { defineConfig } from "@playwright/test";

const remote = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/unit/**"],
  fullyParallel: true,
  workers: 2,
  timeout: 20000,
  expect: { timeout: 5000 },
  reporter: "list",
  use: {
    baseURL: remote || "http://127.0.0.1:4178/",
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    },
    trace: "retain-on-failure",
  },
  webServer: remote
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:4178/",
        reuseExistingServer: !process.env.CI,
      },
});
