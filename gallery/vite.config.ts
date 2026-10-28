import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  // Found by no scan of a stale cache: optimized late, it reloads the page under the first tests (#612).
  // `react-dom/server` is imported only by the static crop tests (`static-crop.tsx`, #644).
  optimizeDeps: { include: ["radix-ui/internal", "react-dom/server"] },
});
