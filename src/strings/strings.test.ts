import { describe, expect, it } from "vitest";

import { suiteStrings } from "./index.js";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const languages = Object.entries(suiteStrings).map(
  ([lng, tree]) => [lng, flatten(tree as Tree)] as const,
);
const enKeys = [...flatten(suiteStrings.en).keys()];

// Content that never belongs in a user-facing text: ticket numbers, env files, spec keys.
const forbidden: [string, RegExp][] = [
  ["ticket number", /#\d+/],
  [".env", /\.env\b/],
  ["spec key", /\b[A-Z]{2,}(?:-[A-Z]+)*-\d{3}\b/],
];

describe("suite strings", () => {
  it.each(languages)("%s has exactly the keys of en", (lng, strings) => {
    const missing = enKeys.filter((key) => !strings.has(key)).map((key) => `${lng} ${key}`);
    const extra = [...strings.keys()].filter((key) => !enKeys.includes(key));
    expect(missing, `missing keys`).toEqual([]);
    expect(
      extra.map((key) => `${lng} ${key}`),
      `keys not in en`,
    ).toEqual([]);
  });

  it.each(languages)("%s has no empty value", (lng, strings) => {
    const empty = [...strings]
      .filter(([, value]) => value.trim() === "")
      .map(([k]) => `${lng} ${k}`);
    expect(empty).toEqual([]);
  });

  it.each(languages)("%s has no forbidden content", (lng, strings) => {
    const hits = [...strings].flatMap(([key, value]) =>
      forbidden.filter(([, re]) => re.test(value)).map(([what]) => `${lng} ${key}: ${what}`),
    );
    expect(hits).toEqual([]);
  });
});

describe("suite action texts", () => {
  it.each([
    ["de", "Anlegen", "Hochladen", "Standard wiederherstellen", "Zurücksetzen"],
    ["en", "Add", "Upload", "Restore defaults", "Reset"],
    ["es", "Añadir", "Subir", "Restaurar valores predeterminados", "Restablecer"],
  ] as const)(
    "%s create, upload, restoreDefaults and reset",
    (lng, create, upload, restoreDefaults, reset) => {
      const { actions } = suiteStrings[lng];
      expect(actions.create).toBe(create);
      expect(actions.upload).toBe(upload);
      expect(actions.restoreDefaults).toBe(restoreDefaults);
      expect(actions.reset).toBe(reset);
    },
  );
});

// SUI-FEATURE-048 AC3: the shared terms, exactly as the spec's table gives them.
describe("suite shared terms", () => {
  const keys = [
    "severity.error",
    "severity.warning",
    "severity.info",
    "outcome.succeeded",
    "outcome.failed",
    "outcome.note",
    "columns.type",
    "confirmDelete.titleOf",
  ];
  it.each([
    [
      "de",
      "Fehler | Warnung | Info | Erfolgreich | Fehlgeschlagen | Notiz | Typ | {{object}} löschen?",
    ],
    ["en", "Error | Warning | Info | Succeeded | Failed | Note | Type | Delete {{object}}?"],
    [
      "es",
      "Error | Advertencia | Información | Correcto | Fallido | Nota | Tipo | ¿Eliminar {{object}}?",
    ],
  ] as const)("%s", (lng, texts) => {
    const strings = flatten(suiteStrings[lng]);
    expect(keys.map((key) => strings.get(key)).join(" | ")).toBe(texts);
  });
});

// SUI-FEATURE-046: the list-state and view-switch texts.
describe("suite list-state texts", () => {
  it.each([
    [
      "de",
      "Noch keine Medien.",
      "Keine Treffer für diesen Filter.",
      "Erneut versuchen",
      "Tabelle",
      "Kacheln",
    ],
    ["en", "No media yet.", "No matches for this filter.", "Try again", "Table", "Tiles"],
    [
      "es",
      "Todavía no hay medios.",
      "Ningún resultado para este filtro.",
      "Reintentar",
      "Tabla",
      "Mosaico",
    ],
  ] as const)(
    "%s emptyOf, noMatches, retry and the two views",
    (lng, emptyOf, noMatches, retry, table, tiles) => {
      const strings = suiteStrings[lng];
      const objects = { de: "Medien", en: "media", es: "medios" }[lng];
      expect(strings.list.emptyOf.replace("{{objects}}", objects)).toBe(emptyOf);
      expect(strings.list.noMatches).toBe(noMatches);
      expect(strings.actions.retry).toBe(retry);
      expect(strings.view.table).toBe(table);
      expect(strings.view.tiles).toBe(tiles);
    },
  );
});

// SUI-FEATURE-044: the 15 state texts in sentence case, in the order of the spec.
describe("suite state texts", () => {
  const order = [
    "succeeded",
    "ok",
    "connected",
    "active",
    "failed",
    "error",
    "untested",
    "unconfigured",
    "expiring",
    "running",
    "inProgress",
    "set",
    "notSet",
    "notTestable",
    "unknown",
  ] as const;
  it.each([
    [
      "de",
      "Erfolgreich, OK, Verbunden, Aktiv, Fehlgeschlagen, Fehler, Ungetestet, Nicht konfiguriert, Läuft ab, Läuft, In Arbeit, Gesetzt, Nicht gesetzt, Nicht testbar, Unbekannt",
    ],
    [
      "en",
      "Succeeded, OK, Connected, Active, Failed, Error, Untested, Not configured, Expiring, Running, In progress, Set, Not set, Not testable, Unknown",
    ],
    [
      "es",
      "Correcto, OK, Conectado, Activo, Fallido, Error, Sin probar, Sin configurar, Por caducar, En ejecución, En curso, Definido, No definido, No comprobable, Desconocido",
    ],
  ] as const)("%s", (lng, texts) => {
    const { state } = suiteStrings[lng];
    expect(order.map((key) => state[key]).join(", ")).toBe(texts);
  });
});

// SUI-FEATURE-047 AC8 and the view switch's name.
describe("suite row texts", () => {
  it.each([
    ["de", "Aktionen", "leer", "Bearbeiten", "Ansicht"],
    ["en", "Actions", "empty", "Edit", "View"],
    ["es", "Acciones", "vacío", "Editar", "Vista"],
  ] as const)("%s list.actions, list.emptyValue, actions.edit, view.label", (lng, ...texts) => {
    const strings = suiteStrings[lng];
    expect([
      strings.list.actions,
      strings.list.emptyValue,
      strings.actions.edit,
      strings.view.label,
    ]).toEqual(texts);
  });
});
