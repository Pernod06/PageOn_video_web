import path from "path";
import AutoImport from "unplugin-auto-import/vite";
import { defineConfig } from "vite";

// vite plugins
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import Fonts from "unplugin-fonts/vite";
import Inspect from "vite-plugin-inspect";
import Pages from "vite-plugin-pages";
import svgr from "vite-plugin-svgr";

import { fonts } from "./configs/fonts.config";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: "http://52.72.117.236:5000",
        changeOrigin: true,
        secure: false,
        timeout: 120000, // 2 minutes timeout
        proxyTimeout: 120000,
        ws: true, // Enable websocket proxy
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.error("[Proxy] ❌ Error:", err.message);
            console.error("[Proxy] Error details:", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("[Proxy] 🔄 Sending request:", req.method, req.url);
            console.log("[Proxy] 🎯 Target:", "http://52.72.117.236:5000" + req.url);
            // Set timeout on the request
            proxyReq.setTimeout(120000);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log("[Proxy] ✅ Response:", proxyRes.statusCode, req.url);
          });
          proxy.on("proxyReqWs", (proxyReq, req, socket, options, head) => {
            console.log("[Proxy] 🔌 WS request:", req.url);
          });
        },
      },
    },
    allowedHosts: ["nonfallacious-garrison-nonsocietal.ngrok-free.dev"],
  },

  plugins: [
    react(),
    Pages({
      dirs: "src/pages",
      extensions: ["tsx", "jsx"],
      importMode: "sync",
    }),
    svgr(),

    Inspect(),
    // ViteImagemin() - commented out due to type issues, uncomment if needed
    tailwindcss(),
    Fonts({ google: { families: fonts } }),
    AutoImport({
      imports: ["react", "react-router"],
      dts: "./auto-imports.d.ts",
      eslintrc: {
        enabled: true,
        // filepath: "./eslint.config.js",
      },
      viteOptimizeDeps: true,

      // uncomment if you want to auto import ui components
      // dirs: ['./src/components/ui'],
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
