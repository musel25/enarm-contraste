import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.ENARM_WEB_PORT || 4178);
const api = `http://127.0.0.1:${process.env.ENARM_PORT || 4187}`;

export default defineConfig({
  root: "app",
  base: "/",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { host: "127.0.0.1", port, strictPort: true, hmr: process.env.ENARM_TEST_MODE === "1" ? false : undefined, proxy: { "/api": api } },
  preview: { host: "127.0.0.1", port, strictPort: true, proxy: { "/api": api } },
});
