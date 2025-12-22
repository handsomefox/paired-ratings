import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "assets/logo.png"],
      manifest: {
        name: "Paired Ratings",
        short_name: "Paired Ratings",
        description: "Track movies and TV shows with paired ratings/comments.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0B3B38",
        background_color: "#0E131D",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/assets\//,
          /^\/manifest\.webmanifest$/,
          /^\/sw\.js$/,
          /^\/workbox-.*\.js$/,
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === "https://image.tmdb.org" && url.pathname.startsWith("/t/p/"),
            handler: "CacheFirst",
            options: {
              cacheName: "tmdb-images",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../internal/web/dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react") || id.includes("react-dom")) return "react";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("sonner")) return "sonner";
          if (
            id.includes("class-variance-authority") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge")
          ) {
            return "ui-utils";
          }
          return "vendor";
        },
      },
    },
  },
});
