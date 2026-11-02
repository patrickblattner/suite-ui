// dependency-cruiser carrier (SUI-FEATURE-128, GL-CODE-002). Finish line: 0 cycles, 0 forbidden
// imports; the counts are carried by the ratchet in quality-baseline.json (scripts/hygiene.ts).
//
// "src/" here is the shipped source: tsup builds every src file except tests, the test setup and
// test-utils (tsup.config.ts), so those test files may import gallery fixtures and each other.
const TEST_FILES = "(\\.test\\.tsx?$|^src/test-setup\\.ts$|/test-utils\\.tsx$)";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "GL-CODE-002: 0 cycles.",
      from: {},
      to: { circular: true },
    },
    {
      name: "src-not-to-gallery",
      severity: "error",
      comment: "SUI-FEATURE-128: the published package never imports the gallery.",
      from: { path: "^src/", pathNot: TEST_FILES },
      to: { path: "^gallery/" },
    },
    {
      name: "src-not-to-tests",
      severity: "error",
      comment:
        "SUI-FEATURE-128: shipped source never imports tests, test fixtures or the test setup.",
      from: { path: "^src/", pathNot: TEST_FILES },
      to: { path: `${TEST_FILES}|^test/` },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^(dist|node_modules|test-results|playwright-report|\\.spec-sync)/" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
