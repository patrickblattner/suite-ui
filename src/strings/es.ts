import type { SuiteStrings } from "./en.js";

export const es: SuiteStrings = {
  actions: {
    save: "Guardar",
    cancel: "Cancelar",
    reset: "Restablecer",
    delete: "Eliminar",
    create: "Crear",
    back: "Volver",
    close: "Cerrar",
  },
  status: {
    success: "Éxito",
    warning: "Advertencia",
    error: "Error",
    info: "Información",
    running: "En curso",
    failed: "Fallido",
    recovered: "Recuperado",
  },
  filter: {
    all: "{{field}}: Todos",
    allValue: "Todos",
    placeholder: "Filtrar…",
    reset: "Borrar filtro",
    label: "Filtrar la lista",
    hint: 'Busca en todas las columnas; varias palabras deben coincidir todas. Una frase entre "comillas" se mantiene unida. Los caracteres sueltos se ignoran.',
  },
  sort: {
    label: "Ordenar por",
    hint: "Define en qué orden aparecen las entradas.",
    updated: "Última edición",
  },
  pagination: {
    firstPage: "Primera página",
    prevPage: "Página anterior",
    nextPage: "Página siguiente",
    lastPage: "Última página",
    summary: "Página {{page}} / {{totalPages}} ({{total}})",
    pageSize: "{{size}} por página",
    pageSizeLabel: "Filas por página",
    pageSizeHint: "Cuántas entradas muestra una página.",
    firstPageDisabled: "Primera página: posible en cuanto estés en una página posterior.",
    prevPageDisabled: "Página anterior: posible en cuanto estés en una página posterior.",
    nextPageDisabled: "Página siguiente: posible en cuanto haya una página después de esta.",
    lastPageDisabled: "Última página: posible en cuanto haya una página después de esta.",
  },
  list: {
    empty: "Aún no hay entradas.",
    noMatches: "No se encontraron entradas.",
  },
  account: {
    menu: "Cuenta",
    signOut: "Cerrar sesión",
  },
  search: {
    placeholder: "Buscar…",
  },
  version: {
    label: "Versión",
  },
  confirmDelete: {
    title: "Confirmar eliminación",
    cancelHint: "Cierra el diálogo sin borrar nada.",
    cancelDisabledHint: "Cerrar vuelve a ser posible en cuanto termine la eliminación.",
    confirmHint: "Borra definitivamente; no se puede deshacer.",
  },
  timezone: {
    placeholder: "Buscar zona horaria…",
    empty: "Ninguna zona horaria coincide",
  },
};
