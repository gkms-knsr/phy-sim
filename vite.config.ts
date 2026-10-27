import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { runtimePath } from "./scripts/runtime-assets.mjs";
export default defineConfig({
  plugins: [react()],
  define: { __PHYSICS_RUNTIME_PATH__: JSON.stringify(runtimePath) },
  build: {
    rollupOptions: {
      output: { manualChunks: { math: ["katex"], charts: ["recharts"] } },
    },
  },
  server: {
    strictPort: true,
    host: "127.0.0.1",
    proxy:
      process.env.VITE_PHYSICS_MODE === "http"
        ? { "/api": "http://127.0.0.1:8000" }
        : undefined,
  },
});
