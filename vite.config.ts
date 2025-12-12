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
    port: 3500,
    proxy: {
      "/api": {
        target: "http://52.72.117.236:5500",
        changeOrigin: true,
        secure: false,
        timeout: 300000, // 5 minutes timeout
        proxyTimeout: 300000,
        ws: true,
        // 防止代理缓冲响应
        selfHandleResponse: false,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, res) => {
            console.error("[Proxy] ❌ Error:", err.message);
            // 防止 ECONNRESET 导致 502
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "text/plain" });
              res.end("Proxy error: " + err.message);
            }
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("[Proxy] 🔄 Sending request:", req.method, req.url);
            proxyReq.setTimeout(300000);
          });
          proxy.on("proxyRes", (proxyRes, req, res) => {
            console.log("[Proxy] ✅ Response:", proxyRes.statusCode, req.url);
            // 对于流式响应，禁用缓冲
            if (
              req.url?.includes("/stream") ||
              proxyRes.headers["content-type"]?.includes("event-stream")
            ) {
              res.setHeader("X-Accel-Buffering", "no");
              res.setHeader("Cache-Control", "no-cache");
            }
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
