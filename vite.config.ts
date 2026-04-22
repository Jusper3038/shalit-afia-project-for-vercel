import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const vendorChunkGroups: Record<string, string[]> = {
  supabase: ["@supabase"],
  charts: ["recharts"],
  query: ["@tanstack"],
  router: ["react-router", "@remix-run"],
  icons: ["lucide-react"],
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 4173,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          for (const [chunkName, markers] of Object.entries(vendorChunkGroups)) {
            if (markers.some((marker) => id.includes(marker))) {
              return chunkName;
            }
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
}));
