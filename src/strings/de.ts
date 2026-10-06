import type { SuiteStrings } from "./en.js";

export const de: SuiteStrings = {
  actions: {
    save: "Speichern",
    cancel: "Abbrechen",
    reset: "Zurücksetzen",
    delete: "Löschen",
    create: "Erstellen",
    back: "Zurück",
    close: "Schließen",
  },
  status: {
    success: "Erfolg",
    warning: "Warnung",
    error: "Fehler",
    info: "Info",
    running: "Läuft",
    failed: "Fehlgeschlagen",
    recovered: "Wiederhergestellt",
  },
  filter: {
    all: "{{field}}: Alle",
    allValue: "Alle",
    placeholder: "Filtern…",
    reset: "Filter zurücksetzen",
    label: "Liste filtern",
    hint: 'Durchsucht alle Spalten; mehrere Wörter müssen alle passen. Eine Wortgruppe in "Anführungszeichen" bleibt zusammen. Einzelne Zeichen werden ignoriert.',
  },
  sort: {
    label: "Sortiert nach",
    hint: "Legt fest, in welcher Reihenfolge die Einträge erscheinen.",
    updated: "Zuletzt bearbeitet",
  },
  pagination: {
    firstPage: "Erste Seite",
    prevPage: "Vorherige Seite",
    nextPage: "Nächste Seite",
    lastPage: "Letzte Seite",
    summary: "Seite {{page}} / {{totalPages}} ({{total}})",
    pageSize: "{{size}} pro Seite",
    pageSizeLabel: "Zeilen pro Seite",
    pageSizeHint: "Wie viele Einträge eine Seite zeigt.",
    firstPageDisabled: "Erste Seite: möglich, sobald du auf einer späteren Seite bist.",
    prevPageDisabled: "Vorherige Seite: möglich, sobald du auf einer späteren Seite bist.",
    nextPageDisabled: "Nächste Seite: möglich, sobald es nach dieser Seite eine weitere gibt.",
    lastPageDisabled: "Letzte Seite: möglich, sobald es nach dieser Seite eine weitere gibt.",
  },
  list: {
    empty: "Noch keine Einträge.",
    noMatches: "Keine Einträge gefunden.",
  },
  account: {
    menu: "Konto",
    signOut: "Abmelden",
  },
  search: {
    placeholder: "Suchen…",
  },
  version: {
    label: "Version",
  },
  confirmDelete: {
    title: "Löschen bestätigen",
    cancelHint: "Schließt den Dialog, ohne etwas zu löschen.",
    cancelDisabledHint: "Schließen geht wieder, sobald das Löschen abgeschlossen ist.",
    confirmHint: "Löscht endgültig; das lässt sich nicht rückgängig machen.",
  },
  timezone: {
    placeholder: "Zeitzone suchen…",
    empty: "Keine passende Zeitzone",
  },
};
