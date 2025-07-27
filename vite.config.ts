// vite.config.ts
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import UnoCSS from "unocss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
export default defineConfig({
    base: "./",
    plugins: [solidPlugin(), UnoCSS(), nodePolyfills()],
    server: {
        port: 8367,
        proxy: {
            "/api": {
                target: "http://localhost:7765",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ""),
            },
        },
    },
    build: {
        outDir: "dist/public",
    },
});
