import { ImageIcon } from "lucide-react";
import { type ImgHTMLAttributes, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Code } from "../ui/code.js";

// The GFM renderer of the help pages (`GL-UI-021`, `SUI-FEATURE-038`). Beyond styling it does two
// things: a missing or empty image source, or an image that fails to load, renders a "Screenshot
// pending" placeholder instead of a broken image, and a link survives only with an HTTP(S) scheme or
// as a relative reference — anything else renders as plain text.

// A leading scheme per RFC 3986 (`scheme ":"`). Used only to tell "has a scheme" from "relative".
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

// The safe href for `value`, or `null` when it is not a link the help renders.
function safeHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw === "") return null;
  if (!SCHEME_RE.test(raw)) {
    // `//evil.example` inherits the page scheme — a real absolute URL, not a relative one.
    return raw.startsWith("//") ? null : raw;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
}

function HelpImage({ src, alt }: ImgHTMLAttributes<HTMLImageElement>) {
  const { t } = useTranslation("suite");
  const [failed, setFailed] = useState(false);
  const resolved = typeof src === "string" ? src.trim() : "";
  const label = alt && alt.length > 0 ? alt : typeof src === "string" ? src : "";

  if (!resolved || failed) {
    return (
      <span className="my-4 block">
        <span
          className="my-2 flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground"
          data-testid="help-screenshot-pending"
        >
          <ImageIcon className="size-4 shrink-0" aria-hidden="true" />
          {t("help.screenshotPending")}
          {label ? ` — ${label}` : ""}
        </span>
      </span>
    );
  }

  return (
    <span className="my-4 block">
      <img
        src={resolved}
        alt={alt ?? ""}
        loading="lazy"
        className="block h-auto max-w-[75%] rounded border border-border shadow-sm"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

const components: Components = {
  h1: ({ children }) => <h1 className="mt-2 mb-4 text-2xl font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-6 mb-3 text-xl font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-5 mb-2 text-lg font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-3 leading-6">{children}</p>,
  ul: ({ children }) => <ul className="my-3 ml-6 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 ml-6 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-6">{children}</li>,
  a: ({ children, href }) => {
    const safe = safeHref(href);
    if (safe === null) {
      return <span data-testid="help-link-unsafe">{children}</span>;
    }
    const external = /^https?:/.test(safe);
    return (
      <a
        href={safe}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className="rounded-sm text-primary underline outline-none hover:no-underline focus-visible:focus-ring"
      >
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => <Code>{children}</Code>,
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-md bg-muted p-3 [font-family:inherit] text-xs">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-3 py-2 align-top">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-border pl-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  img: HelpImage,
};

type HelpMarkdownProps = {
  body: string;
};

function HelpMarkdown({ body }: HelpMarkdownProps) {
  return (
    <article className="text-sm leading-6 text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </ReactMarkdown>
    </article>
  );
}

export { HelpMarkdown, type HelpMarkdownProps };
