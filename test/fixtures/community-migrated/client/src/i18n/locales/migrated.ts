import type { SuiteStrings } from "../../../../../../../src/strings/en.js";

// The community app after the switch: every key the parity map names for it carries the `suite` text.
export function migrated(suite: SuiteStrings) {
  return {
    filter: {
      all: suite.filter.allValue,
      placeholder: suite.filter.placeholder,
      reset: suite.filter.reset,
      helpText: suite.filter.hint,
    },
    sort: {
      hints: { select: suite.sort.hint },
      label: suite.sort.label,
      updated: suite.sort.updated,
      updatedDesc: suite.sort.updated,
    },
    pagination: {
      hints: { pageSize: suite.pagination.pageSizeHint },
      firstPage: suite.pagination.firstPage,
      prevPage: suite.pagination.prevPage,
      nextPage: suite.pagination.nextPage,
      lastPage: suite.pagination.lastPage,
      summary: suite.pagination.summary,
      pageSize: suite.pagination.pageSize,
      pageSizeLabel: suite.pagination.pageSizeLabel,
    },
  };
}
