import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.ENARM_WEB_PORT || 4178);

export default defineConfig({
  root: "app",
  base: "/",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { host: "127.0.0.1", port, strictPort: true, proxy: { "/api": "http://127.0.0.1:4187" } },
  preview: { host: "127.0.0.1", port, strictPort: true, proxy: { "/api": "http://127.0.0.1:4187" } },
});
