import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app imports ../data/*.json and ../css/styles.css, shared with the
// plain-JS prototype, so the dev server may read the parent folder.
// `npm run build` writes a static copy to ../react-demo for GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { fs: { allow: [".."] } },
  build: { outDir: "../react-demo", emptyOutDir: true },
});
