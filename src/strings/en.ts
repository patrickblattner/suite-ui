// English is the source language of the `suite` namespace: its keys define the key set that `de`
// and `es` must match, and its wording is what they translate.
export const en = {
  actions: {
    save: "Save",
    cancel: "Cancel",
    reset: "Reset",
    delete: "Delete",
    create: "Create",
    back: "Back",
    close: "Close",
  },
  status: {
    success: "Success",
    warning: "Warning",
    error: "Error",
    info: "Info",
    running: "Running",
    failed: "Failed",
    recovered: "Recovered",
  },
  filter: {
    // The trigger of a filter dropdown without a choice; `allValue` is the same word as its option.
    all: "{{field}}: All",
    allValue: "All",
    placeholder: "Filter…",
    reset: "Clear filter",
    label: "Filter the list",
    hint: 'Searches every column; several words must all match. A phrase in "quotes" stays together. Single characters are ignored.',
  },
  sort: {
    label: "Sort by",
    hint: "Sets the order in which the entries appear.",
    updated: "Last edited",
  },
  pagination: {
    firstPage: "First page",
    prevPage: "Previous page",
    nextPage: "Next page",
    lastPage: "Last page",
    summary: "Page {{page}} / {{totalPages}} ({{total}})",
    pageSize: "{{size}} per page",
    pageSizeLabel: "Rows per page",
    pageSizeHint: "How many entries one page shows.",
    firstPageDisabled: "First page: possible once you are on a later page.",
    prevPageDisabled: "Previous page: possible once you are on a later page.",
    nextPageDisabled: "Next page: possible once there is a page after this one.",
    lastPageDisabled: "Last page: possible once there is a page after this one.",
  },
  list: {
    empty: "No entries yet.",
    noMatches: "No entries found.",
  },
  account: {
    menu: "Account",
    signOut: "Sign out",
  },
  search: {
    placeholder: "Search…",
  },
  version: {
    label: "Version",
  },
  confirmDelete: {
    title: "Confirm deletion",
    cancelHint: "Closes the dialog without deleting anything.",
    cancelDisabledHint: "Closing becomes possible again once the deletion has finished.",
    confirmHint: "Deletes for good; this cannot be undone.",
  },
  timezone: {
    placeholder: "Search time zone…",
    empty: "No matching time zone",
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type SuiteStrings = Widen<typeof en>;
