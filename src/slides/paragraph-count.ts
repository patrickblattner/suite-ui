// The number of paragraphs of a field's runs: one more than their text holds `\n`; an inline run and
// a line separator (U+2028) start none (`SUI-DESIGN-002` rev 9). Counted without splitting, so a text
// far over the cap costs no more than reading it once. Not part of the barrel.
export function paragraphCount(
  runs: readonly ({ inline?: undefined; text: string } | { inline: string })[],
): number {
  let count = 1;
  for (const run of runs) {
    if (run.inline !== undefined) continue;
    for (let at = run.text.indexOf("\n"); at !== -1; at = run.text.indexOf("\n", at + 1)) count++;
  }
  return count;
}
