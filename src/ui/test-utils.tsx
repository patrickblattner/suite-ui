// React's ids count across a test file, so a snapshot numbers them by first appearance instead.
export function stableIds(html: string): string {
  const ids = new Map<string, string>();
  return html.replace(/_r_[0-9a-z]+_/g, (id) => {
    if (!ids.has(id)) ids.set(id, `id${ids.size + 1}`);
    return ids.get(id)!;
  });
}
