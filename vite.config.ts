import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile({
      // banner 视频体积较大（约 3MB），保持为独立文件，
      // 避免被 base64 内联进单文件 HTML 导致首屏体积暴涨。
      overrideConfig: {
        base: "./",
        build: {
          assetsInlineLimit: 4096,
          chunkSizeWarningLimit: 100000000,
          cssCodeSplit: false,
          assetsDir: "",
          rollupOptions: { output: { inlineDynamicImports: true } },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
