
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Define environment variables that will be replaced at build time
  define: {
    // Make sure ODDS_API_KEY is available from env or provide a fallback for development
    'import.meta.env.VITE_ODDS_API_KEY': JSON.stringify(process.env.ODDS_API_KEY || ''),
  },
}));
