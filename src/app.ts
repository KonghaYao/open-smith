import { serve } from "@hono/node-server";
import { serveStatic } from "hono/serve-static";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
// import { serveStatic } from "hono/bun";
import { MultipartProcessor } from "./multipart-processor.js";
import { createTraceRouter } from "./routes/trace-router.js";
import { TraceDatabase, type DatabaseAdapter } from "./database.js";
import { ApiKeyCache } from "./api-key-cache.js"; // 更新导入路径
import { createAdminRouter } from "./routes/admin-routes.js";
import { createRunsRouter } from "./routes/runs-routes.js";

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { llmRouter } from "./routes/llm-routes.js";

// 实现 __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// API Key 缓存类
// ApiKeyCache 已经导出并移动到外部文件，这里不再需要重复定义

const app = new Hono();

let adapter: DatabaseAdapter;

if (process.env.TRACE_DATABASE_URL) {
    const { PgAdapter } = await import("./adapters/pg-adapter.js");
    adapter = new PgAdapter({
        connectionString: process.env.TRACE_DATABASE_URL,
    });
} else if (
    /** @ts-ignore */
    typeof globalThis.Bun !== "undefined"
) {
    const { BunSQLiteAdapter } = await import(
        "./adapters/bun-sqlite-adapter.js"
    );
    adapter = new BunSQLiteAdapter();
} else {
    const { BetterSqliteAdapter } = await import(
        "./adapters/better-sqlite-adapter.js"
    );
    adapter = new BetterSqliteAdapter();
}

const db = new TraceDatabase(adapter!);
await db.init();

// 创建 API Key 缓存实例
const apiKeyCache = new ApiKeyCache(db);

// 创建全局的 multipart 处理器实例
const multipartProcessor = new MultipartProcessor(db);

// 创建 trace 路由器
const traceRouter = createTraceRouter(multipartProcessor["db"]);

// 创建并挂载 admin 路由器
const adminRouter = createAdminRouter(db, apiKeyCache);
app.route("/admin", adminRouter);

// 创建并挂载 runs 路由器
const runsRouter = createRunsRouter(multipartProcessor, apiKeyCache);
app.route("/runs", runsRouter);

app.use(logger());

// /v1/metadata/submit 路由已移动到 runs-routes.ts

const uiPath = path.join(__dirname, "../public/");
app.use(
    "/ui/*",
    serveStatic({
        root: "./",
        getContent: async (path) => {
            return fs.readFileSync(uiPath + path.replace("ui/", ""), "utf-8");
        },
    }),
);

// 挂载 trace 路由器
app.route("/trace", traceRouter);

app.route("/llm", llmRouter);

// API Key 缓存管理接口、系统管理接口、数据迁移接口等已移动到 admin-routes.ts

app.get("/info", (c) => {
    return c.json({
        // API 版本
        version: "0.10.107",
        // 实例功能标志
        instance_flags: {
            // Blob 存储是否启用
            blob_storage_enabled: true,
            // Blob 存储引擎
            blob_storage_engine: "S3",
            // 数据集示例分段是否启用
            dataset_examples_multipart_enabled: true,
            // 示例分段是否启用
            examples_multipart_enabled: true,
            // 实验性搜索是否启用
            experimental_search_enabled: false,
            // AI 查询生成是否启用
            generate_ai_query_enabled: true,
            // 组织创建是否禁用
            org_creation_disabled: false,
            // 支付是否启用
            payment_enabled: true,
            // 个人组织是否禁用
            personal_orgs_disabled: false,
            // Playground 认证绕过是否启用
            playground_auth_bypass_enabled: false,
            // S3 存储是否启用 (新增)
            s3_storage_enabled: true,
            // 搜索是否启用
            search_enabled: true,
            // 显示 TTL UI
            show_ttl_ui: true,
            // 跟踪层持续时间（天）
            trace_tier_duration_days: {
                longlived: 400,
                shortlived: 14,
            },
            // 工作区范围组织邀请
            workspace_scope_org_invites: false,
            // ZSTD 压缩是否启用 (新增)
            zstd_compression_enabled: false,
        },
        // 批量摄取配置
        batch_ingest_config: {
            // 是否使用分段端点
            use_multipart_endpoint: true,
            // 扩容队列大小触发器
            scale_up_qsize_trigger: 1000,
            // 扩容线程限制
            scale_up_nthreads_limit: 16,
            // 缩容空闲触发器
            scale_down_nempty_trigger: 4,
            // 大小限制
            size_limit: 100,
            // 大小限制（字节）
            size_limit_bytes: 20971520,
        },
        // 可用的 API 端点
        endpoints: {
            dashboard: "GET / - Web Dashboard",
            batch: "POST /runs/batch - Submit batch data",
            multipart: "POST /runs/multipart - Submit multipart data",
            trace_list:
                "GET /trace - Get all traces (supports ?system=xxx filter)",
            trace_systems: "GET /trace/systems - Get all available systems",
            trace_models: "GET /trace/models - Get all available model names",
            trace_threads: "GET /trace/threads - Get all available thread IDs",
            thread_overviews:
                "GET /trace/threads/overview - Get thread overview information (supports ?system=xxx and/or ?thread_id=xxx filters, can be combined)",
            trace_search:
                "GET /trace/traces/search - Search runs by conditions (supports run_type, system, model_name, thread_id, user_id filters, no longer requires conditions)",
            traces_advanced_search:
                "GET /trace/search - Advanced search for traces by conditions (supports system, thread_id, user_id, run_type, model_name filters)",
            traces_search_by_type:
                "GET /trace/search/{type} - Search by type (traces|runs) with conditions (supports system, thread_id, user_id, run_type, model_name filters)",
            trace_by_system:
                "GET /trace/system/{system} - Get traces by system",
            thread_runs:
                "GET /trace/thread/{threadId}/runs - Get runs by thread ID",
            trace_info: "GET /trace/{traceId} - Get complete trace info",
            trace_summary: "GET /trace/{traceId}/summary - Get trace summary",
            trace_stats: "GET /trace/{traceId}/stats - Get trace statistics",
            run_detail: "GET /runs/{runId} - Get run details",
            run_feedback: "GET /runs/{runId}/feedback - Get run feedback",
            run_attachments:
                "GET /runs/{runId}/attachments - Get run attachments",
            // 管理接口
            cache_stats:
                "GET /admin/cache/stats - Get API key cache statistics",
            cache_invalidate:
                "POST /admin/cache/invalidate - Invalidate cache (body: {api_key?: string})",
            admin_systems_list: "GET /admin/systems - Get all system records",
            admin_systems_create:
                "POST /admin/systems - Create new system (body: {name: string, description?: string})",
            admin_systems_update: "PATCH /admin/systems/{id} - Update system",
            admin_systems_regenerate_key:
                "POST /admin/systems/{id}/regenerate-key - Regenerate API key",
            admin_systems_stats:
                "GET /admin/systems/{id}/stats - Get system statistics",
            admin_systems_delete: "DELETE /admin/systems/{id} - Delete system",
            // 数据迁移和验证接口
            admin_migrate_existing_runs:
                "POST /admin/migrate/existing-runs - Migrate existing runs to create system records",
            admin_validate_system_refs:
                "GET /admin/validate/system-references - Validate system references integrity",
        },
    });
});

app.notFound(async (c) => {
    const url = c.req.url;
    const method = c.req.method;
    const headers = c.req.raw.headers;
    let curlCommand = `curl -X ${method} ${url}`;

    // 添加请求头
    for (const [key, value] of headers.entries()) {
        // 排除一些默认的、不需要打印的头
        if (
            ![
                "host",
                "connection",
                "content-length",
                "user-agent",
                "accept-encoding",
            ].includes(key.toLowerCase())
        ) {
            curlCommand += ` -H '${key}: ${value}'`;
        }
    }

    // 处理请求体（仅限 POST, PUT, PATCH）
    if (method === "POST" || method === "PUT" || method === "PATCH") {
        try {
            const contentType = headers.get("content-type");
            if (contentType?.includes("application/json")) {
                const jsonBody = await c.req.json();
                curlCommand += ` -H 'Content-Type: application/json' -d '${JSON.stringify(
                    jsonBody,
                ).replace(/'/g, "'''")}'`;
            } else if (contentType?.includes("multipart/form-data")) {
                // 对于 multipart/form-data，需要特殊处理，因为FormData()会消耗流
                // 这里只能打印一个提示，无法完全重构出 curl -F 命令
                curlCommand += ` -H 'Content-Type: ${contentType}' -F '... (multipart form data, refer to original request)'`;
            } else if (c.req.raw.body) {
                // 尝试读取原始 body，但Hono可能已经消耗了
                // 这里只是一个尝试，不保证成功
                const bodyText = await c.req.text();
                if (bodyText) {
                    curlCommand += ` -d '${bodyText.replace(/'/g, "'''")}'`;
                }
            }
        } catch (e) {
            console.warn("Could not parse request body for curl command:", e);
        }
    }

    console.log(
        "\n--- Incoming Request as Curl Command ---\n" +
            curlCommand +
            "\n--------------------------------------\n",
    );

    return c.text("404 Not Found", 404);
});

app.onError((err, c) => {
    if (err instanceof HTTPException) {
        return err.getResponse();
    }
    console.error(`Error: ${err.message}`);
    return c.text("Internal Server Error", 500);
});

export const close = () => {
    apiKeyCache.invalidate(); // 清理缓存
    multipartProcessor.close();
};
export { app };
