// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";             // or your framework plugin
import tsconfigPaths from "vite-tsconfig-paths";      // if you use path aliases in tsconfig

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths()
  ],
  server: {
    host: true,        // listen on 0.0.0.0, required for some IDE live-preview setups
    port: 8080,        // force port 8080
    strictPort: true,  // fail if 8080 is already in use
    open: true,        // auto-open your browser at http://localhost:8080
  },
});
