import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "**/.spec-sync/**",
      "eslint.config.js",
      // CommonJS tool carriers of the `hygiene` phase, outside the typed project graph like this file.
      ".dependency-cruiser.cjs",
      ".size-limit.cjs",
      // A stand-in app checkout for the parity tests, outside the typed project graph.
      "test/fixtures/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  reactHooks.configs.flat.recommended,
  // GL-CODE-022: plugin `security`, sorted once rule by rule (#861). Every rule runs at `error`
  // except those switched off below with their reason; a confined finding is excepted per finding
  // with `// eslint-disable-next-line security/<rule> -- <confinement>` (GL-CODE-020).
  security.configs.recommended,
  {
    rules: {
      "security/detect-bidi-characters": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-non-literal-fs-filename": "error",
      "security/detect-non-literal-regexp": "error",
      "security/detect-non-literal-require": "error",
      // Off in every repo (GL-CODE-022): uniformly false for typed TypeScript property access.
      "security/detect-object-injection": "off",
      // Off: its findings here are uniformly false — it flags every `===`/`!==` next to a name
      // like `token` or `api`, and this UI package compares no secrets (both findings were a
      // React ref against an object identity and a context value against `null`).
      "security/detect-possible-timing-attacks": "off",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-unsafe-regex": "error",
      "security/detect-invisible-characters": "error",
    },
  },
  {
    // Scoped off the tests (GL-CODE-022): their filesystem paths are the repo's own files next to
    // the test or the temp directory the test created, and their regular expressions are built
    // from and run over the test's own fixed strings — no outside input reaches either.
    files: ["**/*.test.{ts,tsx}", "gallery/**/*.spec.ts"],
    rules: {
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-regexp": "off",
      "security/detect-unsafe-regex": "off",
    },
  },
  prettier,
);
