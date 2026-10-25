import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const PORT = 5179;

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]],
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  fullyParallel: true,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1920, height: 1080 },
    // `GL-TEST-019`: a still scene — fixed time zone and locale; the clock is fixed in the spec.
    timezoneId: "Europe/Zurich",
    locale: "en-US",
  },
  // Headless Chromium hides scrollbars, yet `scrollbar-gutter: stable` still reserves their width, so
  // a sticky column there sees a reserved gutter without a bar. Tests tagged `@scrollbars` measure
  // geometry that depends on a real bar and run with classic scrollbars shown; they take no screenshots.
  // Tests tagged `@touch` also run in WebKit on an iPhone with a touch tap (`SUI-FEATURE-107` AC5):
  // iOS Safari is the main platform of the sidebar overlay.
  projects: [
    { name: "gallery", grepInvert: /@scrollbars/ },
    {
      name: "scrollbars",
      grep: /@scrollbars/,
      use: { launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } },
    },
    { name: "webkit-touch", grep: /@touch/, use: { ...devices["iPhone 15"] } },
  ],
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 0,
      animations: "disabled",
      stylePath: fileURLToPath(new URL("./still-scene.css", import.meta.url)),
    },
  },
  webServer: {
    command: `vite --config gallery/vite.config.ts --port ${PORT} --strictPort`,
    cwd: "..",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
