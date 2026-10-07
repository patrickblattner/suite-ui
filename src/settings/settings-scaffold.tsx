import type * as React from "react";

import { PageHeader } from "../list/page-header.js";
import { Tabs } from "../ui/tabs.js";
import { SettingsFooter } from "./settings-footer.js";

// A settings page in tabs: the app's TabsList (with a dirty dot per TabsTrigger where it wants one)
// and its TabsContent panels, under one Tabs root the scaffold owns.
type SettingsTabs = {
  list: React.ReactNode;
  panels: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

type SettingsScaffoldProps = {
  // The route segment of the page (`/settings/<pageKey>`); the form and footer testids derive from it.
  pageKey: string;
  // The stem of the form, Save/Reset and action-row testids; defaults to `settings-<pageKey>`.
  testIdPrefix?: string;
  // The testid of the form, over the one derived from the prefix.
  formTestId?: string;
  // The testid of the scrolling body; defaults to `settings-body`.
  scrollTestId?: string;
  title: string;
  // One line on what the page sets; nothing else stands between it and the form.
  subtitle: string;
  // The page-wide form with its Save/Reset pair. Pages whose entries save on their own (an
  // integrations page, one pair per entry) leave it out and get the grid without a footer.
  form?: {
    dirty: boolean;
    onSave: () => void;
    onReset: () => void;
    saving?: boolean;
    // `false` locks Save even with changes; Reset still follows `dirty`.
    valid?: boolean;
  };
} & (
  | {
      // The static fields, in the left half.
      left: React.ReactNode;
      // Dynamic content only (status, overviews), in the right half. Without it the right half stays
      // empty; the left column never grows.
      right?: React.ReactNode;
      tabs?: undefined;
    }
  | {
      // A tab row over one full-width body instead of the two halves; one form over every tab.
      tabs: SettingsTabs;
      left?: undefined;
      right?: undefined;
    }
);

// The frame of every settings subpage (`GL-UI-026`): title and subtitle, then directly the form body
// as a two-column grid, then the fixed footer. The page fills the content area and may shrink in it
// (`min-h-0 flex-1` down the chain), so the body is the only scroller and the footer stays at the
// bottom of the content area; without that chain PageScroll would scroll and take the footer along.
// The body is positioned like PageScroll, so absolutely placed helpers (the hidden native checkbox of a
// Checkbox) stay in it instead of lengthening PageScroll or the document. With `tabs` the tab row
// stands above the body and stays put while the body scrolls.
function SettingsScaffold({
  pageKey,
  testIdPrefix,
  formTestId,
  scrollTestId = "settings-body",
  title,
  subtitle,
  left,
  right,
  tabs,
  form,
}: SettingsScaffoldProps) {
  const body =
    tabs !== undefined ? (
      <Tabs
        className="flex min-h-0 flex-1 flex-col gap-4"
        value={tabs.value}
        defaultValue={tabs.defaultValue}
        onValueChange={tabs.onValueChange}
        data-testid="settings-tabs"
      >
        {tabs.list}
        <div className="relative min-h-0 flex-1 overflow-y-auto pb-4" data-testid={scrollTestId}>
          {tabs.panels}
        </div>
      </Tabs>
    ) : (
      <div className="relative min-h-0 flex-1 overflow-y-auto pb-4" data-testid={scrollTestId}>
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
          data-testid={formTestId ?? `${testIdPrefix ?? `settings-${pageKey}`}-form`}
          onSubmit={(event) => {
            event.preventDefault();
            // Enter in a field submits too; it must not start a second save, save nothing or save an
            // invalid form.
            if (form.dirty && form.valid !== false && form.saving !== true) form.onSave();
          }}
        >
          {body}
          <SettingsFooter
            pageKey={pageKey}
            testIdPrefix={testIdPrefix}
            dirty={form.dirty}
            valid={form.valid}
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

export { SettingsScaffold, type SettingsScaffoldProps, type SettingsTabs };
