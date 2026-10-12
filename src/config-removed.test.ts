// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// SUI-FEATURE-002 AC5: with every key gone, the app switch `@suite/ui/config` is gone too, so an app
// still calling `configureSuiteUi({ filterBar: "block" })` fails its typecheck.
const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
  exports: Record<string, unknown>;
};

// Typechecks one virtual module inside `src/` and returns its diagnostic codes.
function diagnosticCodes(source: string): number[] {
  const fileName = `${root}src/__switch-call__.ts`;
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = (name) => (name === fileName ? source : readFile(name));
  host.fileExists = (name) => name === fileName || fileExists(name);
  host.getSourceFile = (name, version) =>
    name === fileName ? ts.createSourceFile(name, source, version) : getSourceFile(name, version);
  const program = ts.createProgram([fileName], options, host);
  return ts
    .getPreEmitDiagnostics(program, program.getSourceFile(fileName))
    .map((diagnostic) => diagnostic.code);
}

describe("app switch removed (SUI-FEATURE-002)", () => {
  it("AC5: the package has no ./config export and no config module", () => {
    expect(Object.keys(pkg.exports)).not.toContain("./config");
    expect(existsSync(`${root}src/config`)).toBe(false);
  });

  it('AC5: configureSuiteUi({ filterBar: "block" }) is a type error', () => {
    // Control: a module that exists resolves without a diagnostic.
    expect(
      diagnosticCodes(
        'import { registerSuiteStrings } from "./strings/index.js";\nvoid registerSuiteStrings;\n',
      ),
    ).toEqual([]);
    // TS2307: cannot find module.
    expect(
      diagnosticCodes(
        'import { configureSuiteUi } from "./config/index.js";\nconfigureSuiteUi({ filterBar: "block" });\n',
      ),
    ).toContain(2307);
  });
});
