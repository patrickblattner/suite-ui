import type * as React from "react";

import { PageHeader } from "../list/page-header.js";
import { SettingsFooter } from "./settings-footer.js";

type SettingsScaffoldProps = {
  // The route segment of the page (`/settings/<pageKey>`); the form and footer testids derive from it.
  pageKey: string;
  title: string;
  // One line on what the page sets; nothing else stands between it and the form.
  subtitle: string;
  // The static fields, in the left half.
  left: React.ReactNode;
  // Dynamic content only (status, overviews), in the right half. Without it the right half stays
  // empty; the left column never grows.
  right?: React.ReactNode;
  // The page-wide form with its Save/Reset pair. Pages whose entries save on their own (an
  // integrations page, one pair per entry) leave it out and get the grid without a footer.
  form?: {
    dirty: boolean;
    onSave: () => void;
    onReset: () => void;
    saving?: boolean;
  };
};

// The frame of every settings subpage (`GL-UI-026`): title and subtitle, then directly the form body
// as a two-column grid, then the fixed footer. The page fills the content area and may shrink in it
// (`min-h-0 flex-1` down the chain), so the body is the only scroller and the footer stays at the
// bottom of the content area; without that chain PageScroll would scroll and take the footer along.
// The body is positioned like PageScroll, so absolutely placed helpers (the hidden native checkbox of a
// Checkbox) stay in it instead of lengthening PageScroll or the document.
function SettingsScaffold({ pageKey, title, subtitle, left, right, form }: SettingsScaffoldProps) {
  const body = (
    <div className="relative min-h-0 flex-1 overflow-y-auto pb-4" data-testid="settings-body">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="settings-grid">
        <div className="flex min-w-0 flex-col gap-4" data-testid="settings-column-left">
          {left}
        </div>
        {right !== undefined ? (
          <div className="flex min-w-0 flex-col gap-4" data-testid="settings-column-right">
            {right}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" data-testid="settings-page">
      <PageHeader title={title} subtitle={subtitle} />
      {form !== undefined ? (
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          data-testid={`settings-${pageKey}-form`}
          onSubmit={(event) => {
            event.preventDefault();
            // Enter in a field submits too; it must not start a second save or save nothing.
            if (form.dirty && form.saving !== true) form.onSave();
          }}
        >
          {body}
          <SettingsFooter
            pageKey={pageKey}
            dirty={form.dirty}
            onReset={form.onReset}
            saving={form.saving}
          />
        </form>
      ) : (
        body
      )}
    </div>
  );
}

export { SettingsScaffold, type SettingsScaffoldProps };
