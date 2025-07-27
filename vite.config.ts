// vite.config.ts
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import UnoCSS from "unocss/vite";
export default defineConfig({
    plugins: [solidPlugin(), UnoCSS()],
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
});
