import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// "single" mode inlines everything into one HTML file (used for quick previews).
export default defineConfig(({ mode }) => ({
  base: "./",
  // Preact from G2: JSX compiles to preact/jsx-runtime.
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  plugins: mode === "single" ? [viteSingleFile()] : [],
  // Unit tests read the stylesheet as text (src/ui/look.test.ts: one typeface, sentence case).
  test: { css: { include: [/style\.css/] } },
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
}));
