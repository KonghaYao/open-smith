import { serve } from "@hono/node-server";
import { app, close } from "./app.js";
// 优雅关闭处理
process.on("SIGINT", () => {
    console.log("Shutting down gracefully...");
    close();
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("Shutting down gracefully...");
    close();
    process.exit(0);
});

serve(
    {
        fetch: app.fetch,
        port: 7765,
    },
    (info) => {
        console.log(`🚀 Server is running on http://localhost:${info.port}`);

        console.log(
            `🎯 Web Dashboard: http://localhost:${info.port}/ui/index.html`,
        );
        console.log(
            `📋 Multipart API: POST http://localhost:${info.port}/runs/multipart`,
        );
        console.log(
            `🔍 Trace API: GET http://localhost:${info.port}/trace/{traceId}`,
        );
    },
);
