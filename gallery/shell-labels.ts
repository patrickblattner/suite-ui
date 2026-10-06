// App-side texts of the gallery shell: the app's own label keys (namespace `translation`) and the
// record data on screen. The visible-text check allows exactly these besides the `suite` namespace.
export const SHELL_LABELS = {
  en: {
    nav: {
      dashboard: "Dashboard",
      ideas: "Ideas",
      calendar: "Calendar",
      tools: "Tools",
      admin: "Administration",
      settings: "Settings",
    },
    page: { subtitle: "A page of the gallery shell." },
    areas: { content: "Content", events: "Events" },
    role: "Administrator",
    notifications: "Notifications",
    notificationsHint: "Turns browser notifications on or off.",
  },
  de: {
    nav: {
      dashboard: "Dashboard",
      ideas: "Ideen",
      calendar: "Kalender",
      tools: "Werkzeuge",
      admin: "Verwaltung",
      settings: "Einstellungen",
    },
    page: { subtitle: "Eine Seite der Galerie-Shell." },
    areas: { content: "Inhalte", events: "Events" },
    role: "Administrator",
    notifications: "Benachrichtigungen",
    notificationsHint: "Schaltet Browser-Benachrichtigungen ein oder aus.",
  },
  es: {
    nav: {
      dashboard: "Panel",
      ideas: "Ideas",
      calendar: "Calendario",
      tools: "Herramientas",
      admin: "Administración",
      settings: "Ajustes",
    },
    page: { subtitle: "Una página de la shell de la galería." },
    areas: { content: "Contenidos", events: "Eventos" },
    role: "Administrador",
    notifications: "Notificaciones",
    notificationsHint: "Activa o desactiva las notificaciones del navegador.",
  },
} as const;

// Record data, the same in every language.
export const SHELL_DATA = {
  instanceName: "Suite gallery",
  userName: "Ada Lovelace",
  count: "3",
  hits: ["Summer meetup", "Summer post", "Planned", "Draft"],
  shortcuts: ["⌘K", "Ctrl K"],
  version: { version: "0.6.0", commit: "a1b2c3d", buildDate: "2026-10-06" },
} as const;

export function shellTexts(lng: keyof typeof SHELL_LABELS): string[] {
  const flatten = (tree: object): string[] =>
    Object.values(tree).flatMap((value) =>
      typeof value === "string" ? [value] : flatten(value as object),
    );
  const initial = SHELL_DATA.userName.charAt(0);
  return [...flatten(SHELL_LABELS[lng]), ...flatten(SHELL_DATA), initial];
}
