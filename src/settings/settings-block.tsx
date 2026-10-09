import * as React from "react";

type SettingsBlockProps = {
  // The name of the entry; it names the block for assistive tech.
  name: string;
  // One line on what the entry is for.
  purpose: string;
  // An optional group at the right of the name line: state, actions, a `SecretCardHeader`.
  aside?: React.ReactNode;
  // The content of the entry.
  children?: React.ReactNode;
};

// The framed block of one entry, such as an integration or a secret (`SUI-FEATURE-043`): a title row
// with the name and the purpose under it, an optional aside at its right aligned on the name line,
// then the content 16 px apart. No legend on the frame.
function SettingsBlock({ name, purpose, aside, children }: SettingsBlockProps) {
  const nameId = React.useId();
  return (
    <section
      aria-labelledby={nameId}
      className="flex flex-col gap-4 rounded-lg border p-4"
      data-slot="settings-block"
    >
      <div className="flex items-start justify-between gap-4" data-slot="settings-block-header">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={nameId} className="text-sm font-semibold" data-slot="settings-block-name">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground">{purpose}</p>
        </div>
        {aside !== undefined ? (
          <div className="shrink-0" data-slot="settings-block-aside">
            {aside}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export { SettingsBlock, type SettingsBlockProps };
