import { Hono } from "hono";
import { MultipartProcessor } from "../multipart-processor.js";
import { ApiKeyCache } from "../api-key-cache.js"; // 更新导入路径

export const createRunsRouter = (
    multipartProcessor: MultipartProcessor,
    apiKeyCache: ApiKeyCache,
) => {
    const runs = new Hono();

    // 辅助函数：从请求头获取系统名称
    async function getSystemNameFromRequest(
        c: any,
    ): Promise<string | undefined> {
        const apiKey = c.req.raw.headers.get("x-api-key");
        if (!apiKey) return undefined;

        const systemName = await apiKeyCache.getSystemNameByApiKey(apiKey);
        return systemName || undefined;
    }

    // API Key 验证和日志中间件
    runs.use("/*", async (c, next) => {
        const apiKey = c.req.raw.headers.get("x-api-key");
        if (apiKey) {
            const systemName = await apiKeyCache.getSystemNameByApiKey(apiKey);
            if (systemName) {
                console.log(
                    `[API Request] System: ${systemName}, API Key: ${apiKey.substring(
                        0,
                        8,
                    )}...`,
                );
            } else {
                return c.json(
                    { success: false, message: "无效的 API Key" },
                    403,
                );
            }
        } else {
            console.warn(`[API Request] Missing API Key`);
        }
        await next();
    });

    // /v1/metadata/submit
    runs.post("/v1/metadata/submit", async (c) => {
        const body = await c.req.json();
        // console.log(body);
        return c.text("");
    });

    runs.post("/batch", async (c) => {
        const body = await c.req.json();
        const fd = new FormData();
        body.patch?.forEach((item: any) => {
            fd.append("patch.222333", JSON.stringify(item));
        });
        body.post?.forEach((item: any) => {
            fd.append("post.222333", JSON.stringify(item));
        });
        const system = await getSystemNameFromRequest(c);
        const result = await multipartProcessor.processMultipartData(
            fd,
            system,
        );
        if (result.success) {
            return c.json({
                success: true,
                message: result.message,
                data: result.data,
            });
        } else {
            return c.json(
                {
                    success: false,
                    message: result.message,
                    errors: result.errors,
                },
                400,
            );
        }
    });

    /** 接受 langSmith 参数的控件 */
    runs.post("/multipart", async (c) => {
        try {
            const formData = await c.req.formData();
            const system = await getSystemNameFromRequest(c);
            const result = await multipartProcessor.processMultipartData(
                formData,
                system,
            );

            if (result.success) {
                return c.json({
                    success: true,
                    message: result.message,
                    data: result.data,
                });
            } else {
                return c.json(
                    {
                        success: false,
                        message: result.message,
                        errors: result.errors,
                    },
                    400,
                );
            }
        } catch (error) {
            console.error("Error processing multipart data:", error);
            return c.json(
                {
                    success: false,
                    message: "Internal server error",
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    return runs;
};
