import path from "path";
import AutoImport from "unplugin-auto-import/vite";
import { defineConfig } from "vite";

// vite plugins
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import Pages from "vite-plugin-pages";
import svgr from "vite-plugin-svgr";

// Extension build configuration
export default defineConfig({
  // Use relative paths for extension
  base: "./",

  build: {
    // Output to extension/dist directory
    outDir: "extension/dist",
    emptyOutDir: true,
    // Ensure assets use relative paths
    assetsDir: "assets",
    rollupOptions: {
      output: {
        // Consistent chunk naming
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },

  plugins: [
    react(),
    Pages({
      dirs: "src/pages",
      extensions: ["tsx", "jsx"],
      importMode: "sync",
    }),
    svgr(),
    tailwindcss(),
    // 注意：扩展模式不使用 unplugin-fonts，因为它会注入内联脚本
    // 字体通过 CSS @import 在 index.css 中加载
    AutoImport({
      imports: ["react", "react-router"],
      dts: "./auto-imports.d.ts",
      eslintrc: {
        enabled: true,
      },
      viteOptimizeDeps: true,
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Define environment variable to signal extension build
  define: {
    "import.meta.env.VITE_IS_EXTENSION": JSON.stringify("true"),
  },
});
