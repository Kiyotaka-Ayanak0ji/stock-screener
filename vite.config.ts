import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
// The dev-only component tagger is optional: it is loaded lazily so the project
// builds and runs in fully offline / self-hosted environments where the
// optional dev dependency is not installed.
async function optionalTagger(mode: string) {
  if (mode !== "development") return null;
  try {
    const mod = await import("lovable-tagger");
    return mod.componentTagger();
  } catch {
    return null;
  }
}

export default defineConfig(async ({ mode }) => ({
  base: './',
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), await optionalTagger(mode)].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
