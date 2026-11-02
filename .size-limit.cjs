// size-limit carrier (SUI-FEATURE-128, GL-CODE-002). One check per package.json `exports` entry,
// resolved to its file in `dist/` (wildcard subpaths expand to every `.js` file they match). Each
// check bundles the entry with its own relative imports, minifies it with esbuild and reports raw
// bytes (never compressed); peer dependencies are not counted — the app brings them.
//
// The two lines per entry live in size-limit-lines.json (`recommended`, `maximum`); size-limit
// judges at `maximum` only. scripts/hygiene.ts turns an entry without lines red.
const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));
const lines = JSON.parse(readFileSync(join(__dirname, "size-limit-lines.json"), "utf8")).entries;

const target = (value) => (typeof value === "string" ? value : value.import);

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .filter((file) => file.endsWith(".js"))
    .sort();
}

function entries() {
  const result = [];
  for (const [subpath, value] of Object.entries(pkg.exports)) {
    const path = target(value).replace(/^\.\//, "");
    if (!subpath.includes("*")) {
      result.push({ name: subpath, path });
      continue;
    }
    const dir = path.slice(0, path.indexOf("*"));
    for (const file of filesUnder(join(__dirname, dir))) {
      result.push({ name: subpath.replace("*", file.replace(/\.js$/, "")), path: dir + file });
    }
  }
  return result;
}

module.exports = entries().map(({ name, path }) => {
  const check = { name, path, gzip: false, brotli: false };
  // The package ships ESM; Node built-ins (used by `./parity`) are never bundled.
  if (path.endsWith(".js")) {
    check.modifyEsbuildConfig = (config) => ({
      ...config,
      format: "esm",
      external: [...(config.external ?? []), "node:*"],
    });
  }
  if (lines[name]) check.limit = `${lines[name].maximum} B`;
  return check;
});
