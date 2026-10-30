import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "app",
  base: "/",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 4178, strictPort: true, proxy: { "/api": "http://127.0.0.1:4187" } },
  preview: { host: "127.0.0.1", port: 4178, strictPort: true, proxy: { "/api": "http://127.0.0.1:4187" } },
});
