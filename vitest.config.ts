import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    setupFiles: ["src/test-setup.ts"],
    // #794: the 5 s default is a wall-clock budget on CPU-bound work (a TypeScript program, a
    // jsdom editor render), so the box's load, not the code, decided red: under parallel gates
    // untouched tests passed it (config-removed AC5, slide-editor 'inserts the app type',
    // slide-editor-text 'refuses paragraphs past the cap', hygiene 'fails closed') and passed alone.
    // A hang still ends red, at this bound; tests that need more keep their own.
    testTimeout: 30_000,
  },
});
