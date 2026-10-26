import { cn } from "../lib/cn.js";

// The clipped full texts of one bubble, each on its own line in document order (`GL-UI-016` rev 16),
// apart as a hint's full text is from its description. The overflow tooltip and the hint share it.
function FullTexts({ lines }: { lines: readonly string[] }) {
  return lines.map((line, index) => (
    <span key={index} className={cn("block", index > 0 && "mt-1")}>
      {line}
    </span>
  ));
}

export { FullTexts };
