import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";

// Gerar IDs únicos UMA VEZ — reutilizados em define + version.json
const buildId = `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const buildTime = new Date().toISOString();

const normalizeRootAssetPaths = (html: string) => html
  .replace(/(src|href)=(['"])\.\/assets\//g, "$1=$2/assets/")
  .replace(/href=(['"])\.\/manifest\.webmanifest\1/g, "href=$1/manifest.webmanifest$1")
  .replace(/navigator\.serviceWorker\.register\((['"])\.\/sw\.js\1/g, "navigator.serviceWorker.register($1/sw.js$1")
  .replace(/scope:\s*(['"])\.\/\1/g, "scope: $1/$1");

const forceRootAssetPathsPlugin = () => ({
  name: "force-root-asset-paths",
  enforce: "post" as const,
  transformIndexHtml: {
    order: "post" as const,
    handler(html: string) {
      return normalizeRootAssetPaths(html);
    },
  },
  closeBundle() {
    const indexPath = path.resolve(__dirname, "dist/index.html");
    if (!fs.existsSync(indexPath)) return;

    const html = fs.readFileSync(indexPath, "utf8");
    const fixedHtml = normalizeRootAssetPaths(html);

    if (fixedHtml !== html) {
      fs.writeFileSync(indexPath, fixedHtml);
    }
  },
});

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const hasSupabaseEnv = Boolean(
    env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );

  // Fail-loud: build de produção sem ENV Supabase deve abortar em vez de
  // cair no fallback hardcoded (evita publicar artefato apontando pro banco errado).
  // O fallback abaixo permanece apenas para desenvolvimento local (command === "serve").
  if (command === "build" && !hasSupabaseEnv) {
    throw new Error(
      "[vite] Build abortado: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias. " +
        "Configure as variáveis no provedor de deploy.",
    );
  }

  const supabaseUrl = hasSupabaseEnv
    ? env.VITE_SUPABASE_URL
    : "https://kurlgmngmglhvknwxjee.supabase.co";
  const supabasePublishableKey = hasSupabaseEnv
    ? env.VITE_SUPABASE_PUBLISHABLE_KEY
    : "sb_publishable_-iEJez4gaykHtGaYEISPgQ_LfrRwMzL";
  const supabaseProjectId = new URL(supabaseUrl).hostname.split(".")[0];

  return {
    base: '/',
    define: {
      __BUILD_TIMESTAMP__: JSON.stringify(buildTime),
      __BUILD_ID__: JSON.stringify(buildId),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabasePublishableKey),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(supabaseProjectId),
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
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
            }],
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
      forceRootAssetPathsPlugin()].filter(Boolean),
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
  };
});
