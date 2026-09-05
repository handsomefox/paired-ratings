import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "assets/apple-touch-icon.png", "assets/logo.png"],
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
          { src: "/assets/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/assets/pwa-512x512.png",
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
    outDir: path.resolve(__dirname, "../backend/web/dist"),
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        // Each pattern ends at a package boundary, so react-day-picker and
        // react-dom no longer land in the react chunk. The first match wins,
        // which is why vendor comes last.
        advancedChunks: {
          groups: [
            {
              name: "react",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            { name: "tanstack", test: /[\\/]node_modules[\\/]@tanstack[\\/]/ },
            { name: "radix", test: /[\\/]node_modules[\\/]@radix-ui[\\/]/ },
            { name: "vendor", test: /[\\/]node_modules[\\/]/ },
          ],
        },
      },
    },
  },
});
