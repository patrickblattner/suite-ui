// The slide document model of `@suite/ui/slides/*`; this barrel re-exports it and stays free of React,
// so a server checks documents with it. The view, player and export are subpaths of their own
// (`slides/slide-view`, `slides/slide-player`, `slides/slide-export`, `slides/export`).
export * from "./brand.js";
export * from "./document.js";
export * from "./schema.js";
