import { Hono } from "hono";
import { TraceDatabase } from "../database.js";
import { ApiKeyCache } from "../api-key-cache.js"; // 更新导入路径

if (!process.env.MASTER_KEY) {
    throw new Error("MASTER_KEY 环境变量未设置");
}

export const createAdminRouter = (
    db: TraceDatabase,
    apiKeyCache: ApiKeyCache,
) => {
    const admin = new Hono();

    // 鉴权中间件：要求请求头中包含有效的 Authorization: Bearer <MASTER_KEY>
    admin.use("/*", async (c, next) => {
        const authHeader = c.req.header("Authorization");
        const expectedMasterKey = process.env.MASTER_KEY;

        if (!expectedMasterKey) {
            console.warn("MASTER_KEY 环境变量未设置，admin 接口将无法访问。");
            return c.json(
                {
                    success: false,
                    message: "服务器配置错误：MASTER_KEY 未设置",
                },
                500,
            );
        }

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return c.json(
                {
                    success: false,
                    message: "未提供有效的认证凭证 (Bearer Token)",
                },
                401,
            );
        }

        const masterKey = authHeader.substring(7); // 移除 "Bearer " 前缀

        if (masterKey !== expectedMasterKey) {
            return c.json(
                { success: false, message: "认证失败：无效的 Master Key" },
                401,
            );
        }
        await next();
    });

    // API Key 缓存管理接口
    admin.get("/cache/stats", (c) => {
        const stats = apiKeyCache.getStats();
        return c.json({
            cache_size: stats.size,
            cached_keys: stats.keys,
            ttl_minutes: 5,
        });
    });

    admin.post("/cache/invalidate", async (c) => {
        const body = await c.req.json().catch(() => ({}));
        const { api_key } = body;

        apiKeyCache.invalidate(api_key);

        return c.json({
            success: true,
            message: api_key
                ? `已清除 API Key ${api_key} 的缓存`
                : "已清除全部缓存",
        });
    });

    // 系统管理接口
    admin.get("/systems", async (c) => {
        try {
            const systems = await db.getAllSystemRecords();
            return c.json({
                success: true,
                data: systems,
            });
        } catch (error) {
            return c.json(
                {
                    success: false,
                    message: "获取系统列表失败",
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    admin.post("/systems", async (c) => {
        try {
            const body = await c.req.json();
            const { name, description, api_key } = body; // 新增 api_key

            if (!name) {
                return c.json(
                    {
                        success: false,
                        message: "系统名称不能为空",
                    },
                    400,
                );
            }

            // 检查提供的 api_key 是否已经存在
            if (api_key) {
                const existingSystem = await db.getSystemByApiKey(api_key);
                if (existingSystem) {
                    return c.json(
                        {
                            success: false,
                            message: "提供的 API Key 已存在",
                        },
                        400,
                    );
                }
            }

            const system = await db.createSystem(name, description, api_key); // 传递 api_key

            return c.json({
                success: true,
                data: system,
                message: "系统创建成功",
            });
        } catch (error) {
            return c.json(
                {
                    success: false,
                    message: "创建系统失败",
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    admin.patch("/systems/:id", async (c) => {
        try {
            const id = c.req.param("id");
            const body = await c.req.json();

            const updatedSystem = await db.updateSystem(id, body);

            if (!updatedSystem) {
                return c.json(
                    {
                        success: false,
                        message: "系统不存在",
                    },
                    404,
                );
            }

            // 清除相关缓存
            apiKeyCache.invalidate(updatedSystem.api_key);

            return c.json({
                success: true,
                data: updatedSystem,
                message: "系统更新成功",
            });
        } catch (error) {
            return c.json(
                {
                    success: false,
                    message: "更新系统失败",
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    admin.post("/systems/:id/regenerate-key", async (c) => {
        try {
            const id = c.req.param("id");

            const oldSystem = await db.getSystemById(id);
            const updatedSystem = await db.regenerateApiKey(id);

            if (!updatedSystem) {
                return c.json(
                    {
                        success: false,
                        message: "系统不存在",
                    },
                    404,
                );
            }

            // 清除旧的缓存
            if (oldSystem) {
                apiKeyCache.invalidate(oldSystem.api_key);
            }

            return c.json({
                success: true,
                data: updatedSystem,
                message: "API Key 重新生成成功",
            });
        } catch (error) {
            return c.json(
                {
                    success: false,
                    message: "重新生成 API Key 失败",
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    admin.get("/systems/:id/stats", async (c) => {
        try {
            const id = c.req.param("id");
            const system = await db.getSystemById(id);

            if (!system) {
                return c.json(
                    {
                        success: false,
                        message: "系统不存在",
                    },
                    404,
                );
            }

            const stats = await db.getSystemStats(system.name);

            return c.json({
                success: true,
                data: {
                    system,
                    stats,
                },
            });
        } catch (error) {
            return c.json(
                {
                    success: false,
                    message: "获取系统统计失败",
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    admin.delete("/systems/:id", async (c) => {
        try {
            const id = c.req.param("id");
            const deletedCount = await db.deleteSystem(id);

            if (!deletedCount) {
                return c.json(
                    {
                        success: false,
                        message: "系统不存在或无法删除",
                    },
                    404,
                );
            }

            // 清除相关缓存（如果知道被删除系统的API Key，这里可以更精确地清除）
            // 由于这里不知道旧的API Key，先清空所有缓存
            apiKeyCache.invalidate();

            return c.json({
                success: true,
                message: "系统删除成功",
            });
        } catch (error) {
            return c.json(
                {
                    success: false,
                    message: "删除系统失败",
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 数据迁移接口
    admin.post("/migrate/existing-runs", async (c) => {
        try {
            const result = await db.migrateExistingRunsToSystems();

            return c.json({
                success: true,
                data: result,
                message: `迁移完成：创建了 ${result.created} 个系统，跳过了 ${result.skipped} 个`,
            });
        } catch (error) {
            return c.json(
                {
                    success: false,
                    message: "数据迁移失败",
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    admin.get("/validate/system-references", async (c) => {
        try {
            const orphanedSystems = await db.validateSystemReferences();

            return c.json({
                success: true,
                data: {
                    orphaned_systems: orphanedSystems,
                    count: orphanedSystems.length,
                },
                message:
                    orphanedSystems.length > 0
                        ? `发现 ${orphanedSystems.length} 个孤立的系统引用`
                        : "所有系统引用都有效",
            });
        } catch (error) {
            return c.json(
                {
                    success: false,
                    message: "验证系统引用失败",
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    return admin;
};
