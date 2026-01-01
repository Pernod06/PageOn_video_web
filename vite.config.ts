import fs from "fs";
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

// Check if SSL certificates exist for HTTPS
const sslKeyPath = path.resolve(__dirname, "./ssl/server.key");
const sslCertPath = path.resolve(__dirname, "./ssl/server.crt");
// 强制使用 HTTP 模式（设置为 false 禁用 HTTPS）
const useHttps = true; // fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath);

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    // Enable HTTPS if certificates exist
    https: useHttps
      ? {
          key: fs.readFileSync(sslKeyPath),
          cert: fs.readFileSync(sslCertPath),
        }
      : undefined,
    proxy: {
      "/api": {
        target: "https://localhost:5000",
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
            // 类型检查：res 可能是 Socket 或 ServerResponse
            if (res && "writeHead" in res && !res.headersSent) {
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
    allowedHosts: [
      "nonfallacious-garrison-nonsocietal.ngrok-free.dev",
      "52.72.117.236",
      "localhost",
    ],
  },

  plugins: [
    react(),
    Pages({
      dirs: "src/pages",
      extensions: ["tsx", "jsx"],
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
