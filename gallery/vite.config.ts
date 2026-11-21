import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  // Found by no scan of a stale cache: optimized late, it reloads the page under the first tests (#612).
  // `react-dom/server` is imported only by the static crop tests (`static-crop.tsx`, #644).
  // The slide icons' lazy map stays out of the pre-bundle (finding #561): bundled beside `lucide-react`,
  // esbuild split every one of its ~1870 icons into a chunk the main entry imports, so each page loaded
  // them all (2142 requests); left out, an icon module loads only when a slide shows it (276).
  optimizeDeps: {
    include: ["radix-ui/internal", "react-dom/server"],
    exclude: ["lucide-react/dynamicIconImports"],
  },
});
