import { Hono } from "hono";
import type { TraceDatabase } from "../database.js";

export interface TraceInfo {
    trace_id: string;
    total_runs: number;
    total_feedback: number;
    total_attachments: number;
    first_run_time: string;
    last_run_time: string;
    runs: any[];
}

export function createTraceRouter(db: TraceDatabase) {
    const traceRouter = new Hono();

    // 获取所有系统列表
    traceRouter.get("/systems", async (c) => {
        try {
            const systems = await db.getAllSystems();
            return c.json({
                success: true,
                systems: systems,
            });
        } catch (error) {
            console.error("Error fetching systems:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 获取线程概览信息 (必须在 /threads 之前定义)
    traceRouter.get("/threads/overview", async (c) => {
        try {
            const system = c.req.query("system");
            const threadId = c.req.query("thread_id");

            // 构建过滤条件
            const filters: { system?: string; thread_id?: string } = {};
            if (system) filters.system = system;
            if (threadId) filters.thread_id = threadId;

            // 使用统一的查询方法
            const threadOverviews = await db.getThreadOverviews(
                Object.keys(filters).length > 0 ? filters : undefined,
            );

            return c.json({
                success: true,
                total: threadOverviews.length,
                threads: threadOverviews,
                filters: filters,
            });
        } catch (error) {
            console.error("Error fetching thread overviews:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 获取所有线程ID列表
    traceRouter.get("/threads", async (c) => {
        try {
            const threadIds = await db.getAllThreadIds();
            return c.json({
                success: true,
                thread_ids: threadIds,
            });
        } catch (error) {
            console.error("Error fetching thread IDs:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 获取所有模型名称列表
    traceRouter.get("/models", async (c) => {
        try {
            const modelNames = await db.getAllModelNames();
            return c.json({
                success: true,
                model_names: modelNames,
            });
        } catch (error) {
            console.error("Error fetching model names:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    traceRouter.get("/traces/search", async (c) => {
        const runType = c.req.query("run_type");
        const system = c.req.query("system");
        const modelName = c.req.query("model_name");
        const threadId = c.req.query("thread_id");
        const user_id = c.req.query("user_id");
        const limit = parseInt(c.req.query("limit") || "10"); // 默认每页10条
        const offset = parseInt(c.req.query("offset") || "0"); // 默认偏移0

        // 构建查询条件
        const conditions: any = {};
        if (runType) conditions.run_type = runType;
        if (system) conditions.system = system;
        if (modelName) conditions.model_name = modelName;
        if (threadId) conditions.thread_id = threadId;
        if (user_id) conditions.user_id = user_id;

        // 移除"至少需要一个条件"的限制，增加扩展性
        // 如果没有任何查询条件，返回最近的 runs（分页）

        try {
            const traces = await db.getRunsByConditions(
                conditions,
                limit,
                offset,
            );
            const total = await db.countRunsByConditions(conditions);

            return c.json({
                success: true,
                conditions: conditions,
                total: total,
                limit: limit,
                offset: offset,
                traces: traces,
            });
        } catch (error) {
            console.error("Error fetching runs by conditions:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 新增：组合条件搜索 traces（更加灵活的搜索端点）
    traceRouter.get("/search", async (c) => {
        const system = c.req.query("system");
        const threadId = c.req.query("thread_id");
        const userId = c.req.query("user_id");
        const runType = c.req.query("run_type");
        const modelName = c.req.query("model_name");
        const limit = parseInt(c.req.query("limit") || "20"); // 默认每页20条
        const offset = parseInt(c.req.query("offset") || "0"); // 默认偏移0

        // 构建查询条件
        const conditions: any = {};
        if (system) conditions.system = system;
        if (threadId) conditions.thread_id = threadId;
        if (userId) conditions.user_id = userId;
        if (runType) conditions.run_type = runType;
        if (modelName) conditions.model_name = modelName;

        try {
            const traces = await db.getTracesByConditions(
                conditions,
                limit,
                offset,
            );
            const total = await db.countTracesByConditions(conditions);

            return c.json({
                success: true,
                conditions: conditions,
                total: total,
                limit: limit,
                offset: offset,
                traces: traces,
                message:
                    Object.keys(conditions).length === 0
                        ? "返回最近的 traces（无过滤条件）"
                        : `根据条件搜索到 ${total} 个 traces`,
            });
        } catch (error) {
            console.error("Error fetching traces by conditions:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 新增：组合条件搜索，支持指定返回数据类型
    traceRouter.get("/search/:type", async (c) => {
        const type = c.req.param("type"); // "traces" 或 "runs"
        const system = c.req.query("system");
        const threadId = c.req.query("thread_id");
        const userId = c.req.query("user_id");
        const runType = c.req.query("run_type");
        const modelName = c.req.query("model_name");
        const limit = parseInt(c.req.query("limit") || "20");
        const offset = parseInt(c.req.query("offset") || "0");

        // 验证类型参数
        if (type !== "traces" && type !== "runs") {
            return c.json(
                {
                    success: false,
                    error: "Invalid type parameter. Must be 'traces' or 'runs'",
                },
                400,
            );
        }

        // 构建查询条件
        const conditions: any = {};
        if (system) conditions.system = system;
        if (threadId) conditions.thread_id = threadId;
        if (userId) conditions.user_id = userId;
        if (runType) conditions.run_type = runType;
        if (modelName) conditions.model_name = modelName;

        try {
            let data, total;

            if (type === "traces") {
                data = await db.getTracesByConditions(
                    conditions,
                    limit,
                    offset,
                );
                total = await db.countTracesByConditions(conditions);
            } else {
                data = await db.getRunsByConditions(conditions, limit, offset);
                total = await db.countRunsByConditions(conditions);
            }

            return c.json({
                success: true,
                type: type,
                conditions: conditions,
                total: total,
                limit: limit,
                offset: offset,
                data: data,
                message: `搜索到 ${total} 个 ${type}`,
            });
        } catch (error) {
            console.error(`Error fetching ${type} by conditions:`, error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 根据系统过滤获取 traces
    traceRouter.get("/system/:system", async (c) => {
        try {
            const system = c.req.param("system");
            const traces = await db.getTracesBySystem(system);
            return c.json({
                success: true,
                system: system,
                total: traces.length,
                traces: traces,
            });
        } catch (error) {
            console.error(
                `Error fetching traces for system ${c.req.param("system")}:`,
                error,
            );
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 根据线程ID获取 runs
    traceRouter.get("/thread/:threadId/runs", async (c) => {
        try {
            const threadId = c.req.param("threadId");
            const runs = await db.getRunsByThreadId(threadId);
            return c.json({
                success: true,
                thread_id: threadId,
                total: runs.length,
                runs: runs,
            });
        } catch (error) {
            console.error(
                `Error fetching runs for thread ${c.req.param("threadId")}:`,
                error,
            );
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 获取所有 traces 列表
    traceRouter.get("/", async (c) => {
        try {
            const system = c.req.query("system");

            let traces;
            if (system) {
                traces = await db.getTracesBySystem(system);
            } else {
                traces = await db.getAllTraces();
            }

            return c.json({
                success: true,
                total: traces.length,
                traces: traces,
                system: system || null,
            });
        } catch (error) {
            console.error("Error fetching all traces:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 获取 trace 的完整信息
    traceRouter.get("/:traceId", async (c) => {
        try {
            const traceId = c.req.param("traceId");
            const runs = await db.getRunsByTraceId(traceId);

            if (runs.length === 0) {
                return c.json({ error: "Trace not found" }, 404);
            }

            // 收集所有相关数据
            let totalFeedback = 0;
            let totalAttachments = 0;
            const enrichedRuns = await Promise.all(
                runs.map(async (run) => {
                    const feedback = await db.getFeedbackByRunId(run.id);
                    const attachments = await db.getAttachmentsByRunId(run.id);

                    totalFeedback += feedback.length;
                    totalAttachments += attachments.length;

                    return {
                        ...run,
                        feedback_count: feedback.length,
                        attachments_count: attachments.length,
                        feedback: feedback,
                        attachments: attachments,
                    };
                }),
            );

            const traceInfo: TraceInfo = {
                trace_id: traceId,
                total_runs: runs.length,
                total_feedback: totalFeedback,
                total_attachments: totalAttachments,
                first_run_time: runs[0].created_at,
                last_run_time: runs[runs.length - 1].created_at,
                runs: enrichedRuns,
            };

            return c.json(traceInfo);
        } catch (error) {
            console.error("Error fetching trace info:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 获取 trace 的概要信息（不包含详细数据）
    traceRouter.get("/:traceId/summary", async (c) => {
        try {
            const traceId = c.req.param("traceId");
            const runs = await db.getRunsByTraceId(traceId);

            if (runs.length === 0) {
                return c.json({ error: "Trace not found" }, 404);
            }

            let totalFeedback = 0;
            let totalAttachments = 0;
            const runSummaries = await Promise.all(
                runs.map(async (run) => {
                    const feedback = await db.getFeedbackByRunId(run.id);
                    const attachments = await db.getAttachmentsByRunId(run.id);

                    totalFeedback += feedback.length;
                    totalAttachments += attachments.length;

                    return {
                        id: run.id,
                        name: run.name,
                        run_type: run.run_type,
                        start_time: run.start_time,
                        end_time: run.end_time,
                        created_at: run.created_at,
                        feedback_count: feedback.length,
                        attachments_count: attachments.length,
                    };
                }),
            );

            const summary = {
                trace_id: traceId,
                total_runs: runs.length,
                total_feedback: totalFeedback,
                total_attachments: totalAttachments,
                first_run_time: runs[0].created_at,
                last_run_time: runs[runs.length - 1].created_at,
                runs_summary: runSummaries,
            };

            return c.json(summary);
        } catch (error) {
            console.error("Error fetching trace summary:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    // 获取 trace 的统计信息
    traceRouter.get("/:traceId/stats", async (c) => {
        try {
            const traceId = c.req.param("traceId");
            const runs = await db.getRunsByTraceId(traceId);

            if (runs.length === 0) {
                return c.json({ error: "Trace not found" }, 404);
            }

            // 计算统计信息
            const runTypes = runs.reduce((acc, run) => {
                acc[run.run_type || "unknown"] =
                    (acc[run.run_type || "unknown"] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            let totalFeedback = 0;
            let totalAttachments = 0;
            let avgFeedbackScore = 0;
            let feedbackCount = 0;

            for (const run of runs) {
                const feedback = await db.getFeedbackByRunId(run.id);
                const attachments = await db.getAttachmentsByRunId(run.id);

                totalFeedback += feedback.length;
                totalAttachments += attachments.length;

                for (const f of feedback) {
                    if (f.score !== null && f.score !== undefined) {
                        avgFeedbackScore += f.score;
                        feedbackCount++;
                    }
                }
            }

            const stats = {
                trace_id: traceId,
                total_runs: runs.length,
                total_feedback: totalFeedback,
                total_attachments: totalAttachments,
                average_feedback_score:
                    feedbackCount > 0 ? avgFeedbackScore / feedbackCount : null,
                run_types: runTypes,
                duration: {
                    first_run: runs[0].created_at,
                    last_run: runs[runs.length - 1].created_at,
                    span_hours:
                        Math.round(
                            ((new Date(
                                runs[runs.length - 1].created_at,
                            ).getTime() -
                                new Date(runs[0].created_at).getTime()) /
                                (1000 * 60 * 60)) *
                                100,
                        ) / 100,
                },
            };

            return c.json(stats);
        } catch (error) {
            console.error("Error fetching trace stats:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    });

    return traceRouter;
}
