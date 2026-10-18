import { safeParseSlideDocument } from "../src/slides/document.js";
import { INVALID_SLIDE_EXAMPLE, SLIDE_EXAMPLES } from "./slide-examples.js";

// `SUI-DESIGN-002` §Abnahme 1 and 2: every example document checked against the package's schema, and
// one invalid document with its named error.
export function SlidesPage() {
  const rows: [name: string, document: unknown][] = [
    ...SLIDE_EXAMPLES,
    ["invalid: opacity 140 %", INVALID_SLIDE_EXAMPLE],
  ];
  return (
    <section aria-labelledby="slides-heading">
      <h2 id="slides-heading">Slide documents</h2>
      <table className="strings-table" data-testid="slide-examples">
        <thead>
          <tr>
            <th scope="col">Example</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, document]) => {
            const result = safeParseSlideDocument(document);
            return (
              <tr key={name} data-testid="slide-example" data-valid={result.ok}>
                <td>{name}</td>
                <td>{result.ok ? "valid" : `${result.error.name}: ${result.error.message}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
