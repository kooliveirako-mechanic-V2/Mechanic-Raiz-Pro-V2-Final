import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";

// Gerar IDs únicos UMA VEZ — reutilizados em define + version.json
const buildId = `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const buildTime = new Date().toISOString();

export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTime),
    __BUILD_ID__: JSON.stringify(buildId),
    // Fallback: ensure VITE_ env vars are inlined even if publish pipeline
    // fails to inject .env. These are public/anon keys, safe to hardcode.
    ...((!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_PUBLISHABLE_KEY) ? {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify("https://cuhkkoqqeguascdsvtky.supabase.co"),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1aGtrb3FxZWd1YXNjZHN2dGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMDIyNjYsImV4cCI6MjA4OTg3ODI2Nn0.0alA3zv0qnf9oXI8A2GOIFBG4WhwAzfZjQ1j5a7RTkA"),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify("cuhkkoqqeguascdsvtky"),
    } : {}),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "generate-version-json",
      writeBundle() {
        const data = {
          app: "mechanic-raiz-pro",
          build_id: buildId,
          build_time: buildTime,
        };
        fs.writeFileSync("dist/version.json", JSON.stringify(data, null, 2));
      },
    },
    VitePWA({
      selfDestroying: true,
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      filename: "sw.js",
      injectRegister: "inline",
      includeAssets: ["favicon.ico", "robots.txt", "favicon.png"],
      manifest: {
        name: "Mechanic Raiz Pro - Sistema para Oficina Mecânica",
        short_name: "Mechanic Raiz Pro",
        description: "Sistema completo de gestão para oficinas mecânicas",
        theme_color: "#0077B6",
        background_color: "#0E1B2A",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/~oauth/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
