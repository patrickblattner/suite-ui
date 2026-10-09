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
  },
  // Headless Chromium hides scrollbars, yet `scrollbar-gutter: stable` still reserves their width, so
  // a sticky column there sees a reserved gutter without a bar. Tests tagged `@scrollbars` measure
  // geometry that depends on a real bar and run with classic scrollbars shown; they take no screenshots.
  projects: [
    { name: "gallery", grepInvert: /@scrollbars/ },
    {
      name: "scrollbars",
      grep: /@scrollbars/,
      use: { launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } },
    },
  ],
  expect: {
    toHaveScreenshot: { maxDiffPixels: 0 },
  },
  webServer: {
    command: `vite --config gallery/vite.config.ts --port ${PORT} --strictPort`,
    cwd: "..",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
