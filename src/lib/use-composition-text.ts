import * as React from "react";

import { holdCompositionTab, isCompositionKey } from "./keyboard.js";

type TextEvent = React.SyntheticEvent<HTMLInputElement>;

interface CompositionText<K> {
  /** The text of the composition running in field `key`, `null` while none runs there. */
  composing: (key: K) => string | null;
  /** The composition and change handlers of field `key`. */
  bind: (key: K) => {
    onCompositionStart: (event: React.CompositionEvent<HTMLInputElement>) => void;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onCompositionEnd: (event: React.CompositionEvent<HTMLInputElement>) => void;
  };
  /**
   * A composition that never ended leaves the field with the blur; a pending handoff (`defer`) still
   * reads the finished text from the field, so it is left to clear it.
   */
  blur: () => void;
  /**
   * Whether the key belongs to a running composition; then the caller acts on nothing. Its Tab moves
   * no focus (`holdCompositionTab`).
   */
  holdKey: (event: React.KeyboardEvent) => boolean;
}

/**
 * Composition-safe text entry of the package's own fields (`GL-UI-039` rev 3, `SUI-FEATURE-126`,
 * #760). The text of a running composition (dead key, IME) is only shown: nothing checks, refuses,
 * searches or applies it, and no key of it — Enter, Escape, Tab — acts. Typed text goes to `type`;
 * the finished text of a composition goes to it once at `compositionend`, read through `finish`,
 * unless it leaves the field's text unchanged (it typed nothing). `K` names the field a composition
 * runs in when one surface has several. With `defer` the finished text is handed over one frame
 * after `compositionend` and stays shown until then; a new composition before that frame keeps it in
 * the field (Korean syllables, Android's word-by-word input), so only the whole text travels.
 * Package-internal, never exported.
 */
function useCompositionText<K = void>(
  type: (text: string, key: K) => void,
  finish: (text: string) => string = (text) => text,
  { defer = false }: { defer?: boolean } = {},
): CompositionText<K> {
  const [composing, setComposing] = React.useState<{ key: K; text: string } | null>(null);
  // The field's text when the composition (or a row of them, with `defer`) began.
  const composedFrom = React.useRef("");
  // The frame that hands a finished composition over (`defer`), 0 while none is pending.
  const handoff = React.useRef(0);
  React.useEffect(() => () => cancelAnimationFrame(handoff.current), []);
  const runsIn = (key: K) => composing !== null && composing.key === key;
  return {
    composing: (key) => (runsIn(key) ? (composing?.text ?? null) : null),
    bind: (key) => ({
      onCompositionStart: (event: TextEvent) => {
        if (handoff.current === 0) composedFrom.current = event.currentTarget.value;
        cancelAnimationFrame(handoff.current);
        handoff.current = 0;
        setComposing({ key, text: event.currentTarget.value });
      },
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        if (runsIn(key)) setComposing({ key, text: event.target.value });
        else type(event.target.value, key);
      },
      onCompositionEnd: (event: TextEvent) => {
        const field = event.currentTarget;
        const end = () => {
          setComposing(null);
          const finished = field.value;
          if (finished !== composedFrom.current) type(finish(finished), key);
        };
        if (!defer) {
          end();
          return;
        }
        setComposing({ key, text: field.value });
        cancelAnimationFrame(handoff.current);
        handoff.current = requestAnimationFrame(() => {
          handoff.current = 0;
          end();
        });
      },
    }),
    blur: () => {
      if (handoff.current === 0) setComposing(null);
    },
    holdKey: (event) => {
      if (!isCompositionKey(event)) return false;
      holdCompositionTab(event);
      return true;
    },
  };
}

export { useCompositionText };
