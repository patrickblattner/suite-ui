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
    nav: {
      label: suite.nav.label,
      toggleSidebar: suite.nav.toggleSidebar,
      help: suite.nav.shared.help,
      adminItems: {
        users: suite.nav.shared.users,
        permissions: suite.nav.shared.permissions,
        systemLog: suite.nav.shared.systemLog,
        backup: suite.nav.shared.backupRestore,
      },
      settingsItems: {
        general: suite.nav.shared.general,
        ai: suite.nav.shared.ai,
        integrations: suite.nav.shared.integrations,
        backup: suite.nav.shared.backup,
        auth: suite.nav.shared.loginSecurity,
      },
      toolsItems: {
        mediaLibrary: suite.nav.shared.mediaLibrary,
        textBlocks: suite.nav.shared.textBlocks,
        brandKit: suite.nav.shared.brandKits,
      },
    },
    navHints: {
      instanceName: suite.nav.home,
      back: suite.nav.backToDashboard,
      help: suite.nav.helpHint,
    },
    shellHints: {
      userMenu: suite.account.menuHint,
      security: suite.account.securityHint,
      logout: suite.account.logOutHint,
      search: suite.search.fieldHint,
      searchHit: suite.search.hitHint,
      version: suite.version.hint,
    },
    language: { label: suite.account.language },
    user: {
      security: suite.account.security,
      appearance: {
        label: suite.account.appearance,
        system: suite.account.system,
        light: suite.account.light,
        dark: suite.account.dark,
      },
    },
    auth: { logout: suite.account.logOut },
    search: {
      open: suite.search.label,
      placeholder: suite.search.placeholder,
      title: suite.search.title,
      subtitleIn: suite.search.subtitle,
      emptyIn: suite.search.empty,
    },
    version: {
      title: suite.version.label,
      label: suite.version.title,
      version: suite.version.version,
      noRelease: suite.version.noRelease,
      commit: suite.version.commit,
      buildDate: suite.version.buildDate,
    },
  };
}
