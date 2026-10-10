import type * as React from "react";

import { PageHeader } from "../list/page-header.js";
import { Skeleton } from "../ui/skeleton.js";
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
  // The page's data is still loading: the body shows a loading row instead of its content.
  loading?: boolean;
  // The page's data failed to load: the translated text naming what was not loaded, shown in the body
  // instead of its content. `loading` wins.
  error?: React.ReactNode;
} & (
  | {
      // The settings page: one column over the full inner width of the body, without a width limit.
      body: React.ReactNode;
      left?: undefined;
      right?: undefined;
      tabs?: undefined;
    }
  | {
      // Legacy, for editors with a live preview only: the static fields, in the left half.
      left: React.ReactNode;
      // Dynamic content only (status, overviews), in the right half. Without it the right half stays
      // empty; the left column never grows.
      right?: React.ReactNode;
      body?: undefined;
      tabs?: undefined;
    }
  | {
      // A tab row over one full-width body instead of the column; one form over every tab.
      tabs: SettingsTabs;
      body?: undefined;
      left?: undefined;
      right?: undefined;
    }
);

// The frame of every settings subpage (`GL-UI-026`): title and subtitle, then directly the form body
// as one full-width column (`body`), a tab row over it (`tabs`) or, for editors with a live preview,
// the legacy two-column grid (`left`/`right`), then the fixed footer. While loading or after a failed
// load the body shows that state instead of its content; header and footer stay, Save is locked.
// The page fills the content area and may shrink in it (`min-h-0 flex-1` down the chain), so the body is the only scroller and the footer stays at the
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
  body,
  left,
  right,
  tabs,
  form,
  loading = false,
  error,
}: SettingsScaffoldProps) {
  const state = loading ? (
    <Skeleton className="h-9 w-full" aria-busy="true" data-testid="settings-loading" />
  ) : error !== undefined ? (
    <p className="text-sm text-destructive-text" role="alert" data-testid="settings-error">
      {error}
    </p>
  ) : null;
  const content =
    state !== null ? (
      <div className="relative min-h-0 flex-1 overflow-y-auto pb-4" data-testid={scrollTestId}>
        {state}
      </div>
    ) : body !== undefined ? (
      <div className="relative min-h-0 flex-1 overflow-y-auto pb-4" data-testid={scrollTestId}>
        <div className="flex flex-col gap-6" data-testid="settings-column">
          {body}
        </div>
      </div>
    ) : tabs !== undefined ? (
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
            if (form.dirty && form.valid !== false && form.saving !== true && state === null)
              form.onSave();
          }}
        >
          {content}
          <SettingsFooter
            pageKey={pageKey}
            testIdPrefix={testIdPrefix}
            dirty={form.dirty}
            valid={form.valid !== false && state === null}
            onReset={form.onReset}
            saving={form.saving}
          />
        </form>
      ) : (
        content
      )}
    </div>
  );
}

export { SettingsScaffold, type SettingsScaffoldProps, type SettingsTabs };
