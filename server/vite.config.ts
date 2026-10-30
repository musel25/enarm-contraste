import { defineConfig } from "vite";

export default defineConfig({
  build: { ssr: "server/main.ts", target: "node22", outDir: "dist-server", minify: false, rollupOptions: { output: { entryFileNames: "server.mjs" } } },
  ssr: { noExternal: ["ts-fsrs"] },
});
