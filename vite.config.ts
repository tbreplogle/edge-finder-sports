
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tsconfigPaths(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  server: {
    host: true,        // listen on 0.0.0.0, required for some IDE live-preview setups
    port: 8080,        // force port 8080
    strictPort: true,  // fail if 8080 is already in use
    open: true,        // auto-open your browser at http://localhost:8080
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
