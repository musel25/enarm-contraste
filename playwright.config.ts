import { defineConfig } from "@playwright/test";

const remote = process.env.PLAYWRIGHT_BASE_URL;
const webPort = process.env.ENARM_TEST_WEB_PORT || "4278";
const apiPort = process.env.ENARM_TEST_API_PORT || "4287";
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/unit/**"],
  fullyParallel: true,
  workers: 2,
  timeout: 20000,
  expect: { timeout: 5000 },
  reporter: "list",
  use: {
    baseURL: remote || `http://127.0.0.1:${webPort}/`,
    browserName: "chromium",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
    trace: "retain-on-failure",
  },
  webServer: remote
    ? undefined
    : {
        command: `node scripts/dev.mjs --test${process.env.PLAYWRIGHT_PREVIEW ? " --preview" : ""}`,
        env: { ENARM_WEB_PORT: webPort, ENARM_PORT: apiPort },
        url: `http://127.0.0.1:${webPort}/`,
        reuseExistingServer: false,
      },
});
