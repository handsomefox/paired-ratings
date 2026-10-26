import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    VitePWA({
      // Prompt instead of reloading on its own, so an update never discards
      // unsaved edits. main.tsx shows the prompt.
      registerType: "prompt",
      includeAssets: ["favicon.ico", "icons/apple-touch-icon.png", "icons/logo.png"],
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
          { src: "/icons/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // The default patterns leave out the self-hosted Inter files, so the
        // app would fall back to the system font when offline.
        globPatterns: ["**/*.{js,css,html,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/assets\//,
          /^\/icons\//,
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
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
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
    // The build script in package.json passes the same path to precompress.
    outDir: fileURLToPath(new URL("../backend/web/dist", import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        // Each pattern ends at a package boundary, so a package whose name
        // merely starts with "react" does not land in the react chunk. The
        // first match wins, which is why vendor comes last.
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
