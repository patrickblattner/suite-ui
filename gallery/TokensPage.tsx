/// <reference types="vite/client" />
import styles from "../src/styles.css?raw";

// The token names come straight from `:root` in styles.css, so a new token shows up here unasked.
const root = /\n:root \{([\s\S]*?)\n\}/.exec(styles)?.[1] ?? "";
// A colour is an `oklch(…)` value or an alias (`var(--x)`) of a colour; an alias of a length (the
// toast offset) is no swatch.
const declared = new Map(
  [...root.matchAll(/--([a-z0-9-]+):\s*(oklch\(|var\(--([a-z0-9-]+)\))/g)].map(
    (m) => [m[1] as string, m[3]] as const,
  ),
);
const isColor = (name: string): boolean =>
  declared.has(name) && (declared.get(name) === undefined || isColor(declared.get(name)!));
const colors = [...declared.keys()].filter(isColor);
const textTokens = colors.filter((name) => name.endsWith("-text"));

// A fill shows a sample of the text that sits on it: its own `-foreground`, which for a hover step
// is the one of its resting fill.
function foregroundOf(name: string): string | undefined {
  const candidate = `${name.replace(/-hover$/, "")}-foreground`;
  return name === "background" ? "foreground" : colors.includes(candidate) ? candidate : undefined;
}

export function TokensPage() {
  return (
    <>
      <section aria-labelledby="colors-heading" className="flex flex-col gap-2">
        <h2 id="colors-heading" className="text-lg font-medium">
          Colors
        </h2>
        <ul className="grid grid-cols-8 gap-3">
          {colors.map((name) => {
            const foreground = foregroundOf(name);
            return (
              <li key={name} data-testid={`token-${name}`} className="flex flex-col gap-1">
                <div
                  className="flex h-12 items-center justify-center rounded-md border"
                  style={{
                    background: `var(--${name})`,
                    color: foreground ? `var(--${foreground})` : undefined,
                  }}
                >
                  {foreground ? "Aa" : null}
                </div>
                <span className="truncate">{name}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-labelledby="text-heading" className="mt-6 flex flex-col gap-2">
        <h2 id="text-heading" className="text-lg font-medium">
          Text tokens
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {(["background", "card"] as const).map((ground) => (
            <div
              key={ground}
              data-testid={`text-on-${ground}`}
              className="flex flex-col gap-2 rounded-md border p-4"
              style={{ background: `var(--${ground})` }}
            >
              <span className="text-muted-foreground">on {ground}</span>
              {textTokens.map((name) => (
                <span key={name} style={{ color: `var(--${name})` }}>
                  {name} — The quick brown fox jumps over the lazy dog
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
