import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    proxy: {
      "/api-goszakupki": {
        target: "https://api.goszakupki.by",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-goszakupki/, ""),
      },
    },
  },
});
