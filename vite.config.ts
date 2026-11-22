import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// "single" mode inlines everything into one HTML file (used for quick previews).
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: mode === "single" ? [viteSingleFile()] : [],
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
}));
