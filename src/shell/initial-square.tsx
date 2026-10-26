// The first letter of a name, uppercased: its first code point (an emoji or a CJK Ext-B character is
// one, never half a surrogate pair), after leading spaces; `undefined` for an empty or blank name.
export function initialOf(name: string): string | undefined {
  return Array.from(name.trim())[0]?.toUpperCase();
}

// The initial square of the sidebar (`GL-UI-019`, `GL-UI-020`): the first letter of a name in the
// primary colour with its contrast colour, the same in the instance-name block and the user block.
// A blank name shows no square, never an empty primary one.
export function InitialSquare({ name, testId }: { name: string; testId?: string }) {
  const initial = initialOf(name);
  if (initial === undefined) return null;
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground"
    >
      {initial}
    </span>
  );
}
