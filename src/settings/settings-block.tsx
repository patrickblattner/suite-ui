import * as React from "react";

import {
  createFieldDrafts,
  FieldDraftsContext,
  SettingsBlockDraftsContext,
} from "../ui/field-drafts-internal.js";
import { SubgroupTitle } from "../ui/subgroup-title.js";

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
// then the content 8 px under the header (`SUI-FEATURE-300`) and 16 px apart. No legend on the frame.
// A draft scope (`SUI-FEATURE-118` rev 10): a field's uncommitted entry inside it, aside included,
// registers with the block, for its `SettingsActionRow`, and with the page guard or panel around it.
// Where drafts do not register (a plain `Dialog`), the block registers none either.
function SettingsBlock({ name, purpose, aside, children }: SettingsBlockProps) {
  const nameId = React.useId();
  const parent = React.useContext(FieldDraftsContext);
  const drafts = React.useMemo(
    () => (parent === null ? null : createFieldDrafts(parent)),
    [parent],
  );
  return (
    <section
      aria-labelledby={nameId}
      className="flex flex-col gap-4 rounded-lg border p-4"
      data-slot="settings-block"
    >
      <FieldDraftsContext.Provider value={drafts}>
        <SettingsBlockDraftsContext.Provider value={drafts}>
          <div
            className="flex items-start justify-between gap-4 not-last:-mb-2"
            data-slot="settings-block-header"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <SubgroupTitle asChild>
                <h3 id={nameId} data-slot="settings-block-name">
                  {name}
                </h3>
              </SubgroupTitle>
              <p className="text-sm text-muted-foreground">{purpose}</p>
            </div>
            {aside !== undefined ? (
              <div className="shrink-0" data-slot="settings-block-aside">
                {aside}
              </div>
            ) : null}
          </div>
          {children}
        </SettingsBlockDraftsContext.Provider>
      </FieldDraftsContext.Provider>
    </section>
  );
}

export { SettingsBlock, type SettingsBlockProps };
