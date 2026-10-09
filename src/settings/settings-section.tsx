import type * as React from "react";

type SettingsSectionProps = {
  title: string;
  // One line on what the section sets.
  description: string;
  // An optional control at the right of the head, top-aligned with the title.
  action?: React.ReactNode;
  // The fields of the section.
  children: React.ReactNode;
};

// One section of a settings page (`SUI-FEATURE-042`): a head with the title as `h2` and the
// description under it, an optional action at its right, a divider under the head, then the fields
// 16 px apart.
function SettingsSection({ title, description, action, children }: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-4" data-slot="settings-section">
      <div
        className="flex items-start justify-between gap-4 border-b border-border pb-4"
        data-slot="settings-section-header"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold" data-slot="settings-section-title">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action !== undefined ? (
          <div className="shrink-0" data-slot="settings-section-action">
            {action}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-4" data-slot="settings-section-content">
        {children}
      </div>
    </section>
  );
}

export { SettingsSection, type SettingsSectionProps };
