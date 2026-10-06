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
    all: "{{field}}: All",
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
