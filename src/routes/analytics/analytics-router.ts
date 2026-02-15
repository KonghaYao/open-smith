import { Hono } from "hono";
import type { Kysely } from "kysely";
import type { Database } from "../../database/schema.js";
import { sql } from "kysely";
import { z } from "zod";

// 请求参数验证 Schema
const TimeseriesQuerySchema = z.object({
    dimension: z.enum(["system", "model_name", "run_type", "user_id"]).optional(),
    metrics: z.string().transform((val) => val.split(",")),
    granularity: z.enum(["5min", "15min", "30min", "1h", "1d", "1w", "1m"]).default("1h"),
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
    filters: z.string().optional().transform((val) => val ? JSON.parse(val) : {}),
    limit: z.coerce.number().min(1).max(1000).default(100),
    offset: z.coerce.number().min(0).default(0),
});

const TrendQuerySchema = z.object({
    metric: z.enum([
        "total_runs",
        "successful_runs",
        "failed_runs",
        "error_rate",
        "avg_duration_ms",
        "p95_duration_ms",
        "p99_duration_ms",
        "total_tokens",
        "avg_tokens_per_run",
        "avg_ttft_ms",
        "distinct_users"
    ]),
    period: z.enum(["dod", "wow", "mom"]).default("dod"),
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
    filters: z.string().optional().transform((val) => val ? JSON.parse(val) : {}),
});

const CompareQuerySchema = z.object({
    compare_by: z.enum(["model", "system", "time_period"]).default("model"),
    metrics: z.string().transform((val) => val.split(",")),
    start_time_1: z.string().datetime(),
    end_time_1: z.string().datetime(),
    start_time_2: z.string().datetime().optional(),
    end_time_2: z.string().datetime().optional(),
    filters: z.string().optional().transform((val) => val ? JSON.parse(val) : {}),
});

const AnomalyQuerySchema = z.object({
    metric: z.enum([
        "avg_duration_ms",
        "p95_duration_ms",
        "p99_duration_ms",
        "avg_tokens_per_run",
        "avg_ttft_ms"
    ]),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    threshold: z.coerce.number().min(1).max(10).default(3),
    filters: z.string().optional().transform((val) => val ? JSON.parse(val) : {}),
});

const SummaryQuerySchema = z.object({
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
    filters: z.string().optional().transform((val) => val ? JSON.parse(val) : {}),
});

// 指标映射
const METRIC_MAP: Record<string, string> = {
    total_runs: "total_runs",
    successful_runs: "successful_runs",
    failed_runs: "failed_runs",
    error_rate: "error_rate",
    avg_duration_ms: "avg_duration_ms",
    p95_duration_ms: "p95_duration_ms",
    p99_duration_ms: "p99_duration_ms",
    total_tokens: "total_tokens_sum",
    total_tokens_sum: "total_tokens_sum",
    avg_tokens: "avg_tokens_per_run",
    avg_tokens_per_run: "avg_tokens_per_run",
    avg_ttft_ms: "avg_ttft_ms",
    p95_ttft_ms: "p95_ttft_ms",
    distinct_users: "distinct_users",
};

export function createAnalyticsRouter(db: Kysely<Database>) {
    const app = new Hono();

    // GET /api/v1/analytics/debug - 调试端点
    app.get("/debug", async (c) => {
        try {
            // 检查连续聚合视图是否存在
            const views = await sql`
                SELECT view_name, materialized_only
                FROM timescaledb_information.continuous_aggregates
                ORDER BY view_name
            `.execute(db);

            // 检查各视图的行数
            const stats = await sql`
                SELECT
                    'run_stats_raw' as table_name,
                    COUNT(*) as row_count,
                    MIN(stat_hour) as min_time,
                    MAX(stat_hour) as max_time
                FROM run_stats_raw
                UNION ALL
                SELECT
                    'run_stats_hourly' as table_name,
                    COUNT(*) as row_count,
                    MIN(stat_hour) as min_time,
                    MAX(stat_hour) as max_time
                FROM run_stats_hourly
                UNION ALL
                SELECT
                    'run_stats_15min' as table_name,
                    COUNT(*) as row_count,
                    MIN(stat_period) as min_time,
                    MAX(stat_period) as max_time
                FROM run_stats_15min
            `.execute(db);

            return c.json({
                success: true,
                data: {
                    continuous_aggregates: views.rows,
                    table_stats: stats.rows,
                },
            });
        } catch (error: any) {
            console.error("Error in /debug:", error);
            return c.json({
                success: false,
                error: error.message,
            }, 500);
        }
    });

    // GET /api/v1/analytics/refresh - 刷新连续聚合视图
    app.post("/refresh", async (c) => {
        try {
            const { view_name } = await c.req.json();

            if (!view_name || !["run_stats_hourly", "run_stats_15min", "run_stats_daily", "run_stats_weekly", "run_stats_monthly"].includes(view_name)) {
                return c.json({ error: "Invalid view_name" }, 400);
            }

            await sql`CALL refresh_continuous_aggregate(${sql.literal(view_name)}, window_start => NULL, window_end => NULL)`.execute(db);

            return c.json({
                success: true,
                message: `Refreshed continuous aggregate view: ${view_name}`,
            });
        } catch (error: any) {
            console.error("Error in /refresh:", error);
            return c.json({
                success: false,
                error: error.message,
            }, 500);
        }
    });

    // GET /api/v1/analytics/timeseries - 时序数据聚合
    app.get("/timeseries", async (c) => {
        try {
            const query = TimeseriesQuerySchema.parse(c.req.query());

            // 目前只支持从 run_stats_raw 表查询
            if (query.granularity !== "1h") {
                return c.json({
                    success: false,
                    error: {
                        code: "UNSUPPORTED_GRANULARITY",
                        message: `Currently only '1h' granularity is supported`,
                    },
                }, 400);
            }

            const validMetrics = query.metrics.filter(m => METRIC_MAP[m]);
            const hasDimension = !!query.dimension;
            const dimensionColumn = query.dimension || "null";

            // 构建 SELECT 子句
            let selectClause = "time_bucket('1 hour', stat_hour) as time";
            if (hasDimension) {
                selectClause += `, ${dimensionColumn} as dimension_value`;
            }

            // 构建指标聚合
            const metricClauses: string[] = [];
            for (const metric of validMetrics) {
                if (metric === "total_runs") {
                    metricClauses.push("COUNT(*) as total_runs");
                } else if (metric === "successful_runs") {
                    metricClauses.push("COUNT(*) FILTER (WHERE is_success = true) as successful_runs");
                } else if (metric === "failed_runs") {
                    metricClauses.push("COUNT(*) FILTER (WHERE is_success = false) as failed_runs");
                } else if (metric === "error_rate") {
                    metricClauses.push("(COUNT(*) FILTER (WHERE is_success = false)::FLOAT / NULLIF(COUNT(*), 0)) as error_rate");
                } else if (metric === "avg_duration_ms") {
                    metricClauses.push("AVG(duration_ms) as avg_duration_ms");
                } else if (metric === "p95_duration_ms") {
                    metricClauses.push("percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms");
                } else if (metric === "p99_duration_ms") {
                    metricClauses.push("percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_duration_ms");
                } else if (metric === "total_tokens" || metric === "total_tokens_sum") {
                    metricClauses.push("SUM(token_count) as total_tokens_sum");
                } else if (metric === "avg_tokens" || metric === "avg_tokens_per_run") {
                    metricClauses.push("AVG(token_count) as avg_tokens_per_run");
                } else if (metric === "avg_ttft_ms") {
                    metricClauses.push("AVG(ttft_ms) as avg_ttft_ms");
                } else if (metric === "p95_ttft_ms") {
                    metricClauses.push("percentile_cont(0.95) WITHIN GROUP (ORDER BY ttft_ms) as p95_ttft_ms");
                } else if (metric === "distinct_users") {
                    metricClauses.push("COUNT(DISTINCT user_id) as distinct_users");
                }
            }

            selectClause += ", " + metricClauses.join(", ");

            // 构建 WHERE 子句
            const whereConditions: string[] = [];
            if (query.filters.system?.length) {
                whereConditions.push(`system IN ('${query.filters.system.join("','")}')`);
            }
            if (query.filters.model_name?.length) {
                whereConditions.push(`model_name IN ('${query.filters.model_name.join("','")}')`);
            }
            if (query.filters.user_id) {
                whereConditions.push(`user_id = '${query.filters.user_id}'`);
            }
            if (query.start_time) {
                whereConditions.push(`stat_hour >= '${new Date(query.start_time).toISOString()}'`);
            }
            if (query.end_time) {
                whereConditions.push(`stat_hour <= '${new Date(query.end_time).toISOString()}'`);
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

            // 构建 GROUP BY 子句
            let groupByClause = "GROUP BY time_bucket('1 hour', stat_hour)";
            if (hasDimension) {
                groupByClause += `, ${dimensionColumn}`;
            }

            // 构建 ORDER BY 和 LIMIT
            const orderByClause = "ORDER BY time";
            const limitClause = `LIMIT ${query.limit} OFFSET ${query.offset}`;

            // 完整的 SQL 查询字符串
            const fullSql = `
                SELECT
                    ${selectClause}
                FROM run_stats_raw
                ${whereClause}
                ${groupByClause}
                ${orderByClause}
                ${limitClause}
            `;

            // 使用 sql.raw 执行原生 SQL
            const results = await sql.raw(fullSql).execute(db);

            // 格式化返回数据
            const data = results.rows.map((row: any) => {
                const item: any = {
                    time: row.time ? new Date(row.time).toISOString() : "",
                };

                if (query.dimension) {
                    item.dimensions = {
                        [query.dimension]: row.dimension_value,
                    };
                }

                item.metrics = {};
                for (const metric of validMetrics) {
                    const metricKey = metric === "total_tokens" || metric === "total_tokens_sum" ? "total_tokens_sum" : metric;
                    item.metrics[metric] = row[metricKey] ?? null;
                }

                return item;
            });

            // 获取总数
            const total = data.length;

            return c.json({
                success: true,
                data,
                meta: {
                    total,
                    limit: query.limit,
                    offset: query.offset,
                },
            });
        } catch (error: any) {
            console.error("Error in /timeseries:", error);
            return c.json({
                success: false,
                error: {
                    code: "ANALYTICS_ERROR",
                    message: error.message || "Failed to query time series data",
                },
            }, 500);
        }
    });

    // GET /api/v1/analytics/trends - 趋势分析
    app.get("/trends", async (c) => {
        try {
            const query = TrendQuerySchema.parse(c.req.query());

            // 计算时间范围
            let endTime = query.end_time ? new Date(query.end_time) : new Date();
            let startTime = query.start_time ? new Date(query.start_time) : new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

            // 根据周期计算前一个周期
            let previousEndTime = new Date(startTime);
            let previousStartTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();

            switch (query.period) {
                case "dod": // Day over Day
                    previousStartTime = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case "wow": // Week over Week
                    previousStartTime = new Date(startTime.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case "mom": // Month over Month
                    previousStartTime = new Date(startTime.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
            }

            // 构建指标查询
            let metricExpression = "";
            switch (query.metric) {
                case "total_runs":
                    metricExpression = "COUNT(*)";
                    break;
                case "successful_runs":
                    metricExpression = "COUNT(*) FILTER (WHERE is_success = true)";
                    break;
                case "failed_runs":
                    metricExpression = "COUNT(*) FILTER (WHERE is_success = false)";
                    break;
                case "error_rate":
                    metricExpression = "(COUNT(*) FILTER (WHERE is_success = false)::FLOAT / NULLIF(COUNT(*), 0))";
                    break;
                case "avg_duration_ms":
                    metricExpression = "AVG(duration_ms)";
                    break;
                case "p95_duration_ms":
                    metricExpression = "percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)";
                    break;
                case "p99_duration_ms":
                    metricExpression = "percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms)";
                    break;
                case "total_tokens":
                    metricExpression = "SUM(token_count)";
                    break;
                case "avg_tokens_per_run":
                    metricExpression = "AVG(token_count)";
                    break;
                case "avg_ttft_ms":
                    metricExpression = "AVG(ttft_ms)";
                    break;
                case "distinct_users":
                    metricExpression = "COUNT(DISTINCT user_id)";
                    break;
            }

            // 查询当前周期数据
            const currentSql = `
                SELECT ${metricExpression} as value
                FROM run_stats_raw
                WHERE stat_hour >= '${startTime.toISOString()}' AND stat_hour <= '${endTime.toISOString()}'
            `;
            const currentResult = await sql.raw(currentSql).execute(db);

            // 查询前一个周期数据
            const previousSql = `
                SELECT ${metricExpression} as value
                FROM run_stats_raw
                WHERE stat_hour >= '${previousStartTime.toISOString()}' AND stat_hour <= '${previousEndTime.toISOString()}'
            `;
            const previousResult = await sql.raw(previousSql).execute(db);

            const currentValue = Number(currentResult.rows[0]?.value ?? 0);
            const previousValue = Number(previousResult.rows[0]?.value ?? 0);
            const diff = currentValue - previousValue;
            const percentage = previousValue > 0 ? (diff / previousValue) * 100 : 0;

            return c.json({
                success: true,
                data: {
                    current: {
                        value: currentValue,
                        period: endTime.toISOString(),
                    },
                    previous: {
                        value: previousValue,
                        period: previousEndTime.toISOString(),
                    },
                    trend: {
                        value: diff,
                        percentage: Math.round(percentage * 100) / 100,
                        direction: diff >= 0 ? "up" : "down",
                    },
                },
            });
        } catch (error: any) {
            console.error("Error in /trends:", error);
            return c.json({
                success: false,
                error: {
                    code: "ANALYTICS_ERROR",
                    message: error.message || "Failed to query trend data",
                },
            }, 500);
        }
    });

    // GET /api/v1/analytics/compare - 性能对比
    app.get("/compare", async (c) => {
        return c.json({
            success: false,
            error: {
                code: "NOT_IMPLEMENTED",
                message: "This endpoint is not yet implemented",
            },
        }, 501);
    });

    // GET /api/v1/analytics/anomalies - 异常检测
    app.get("/anomalies", async (c) => {
        return c.json({
            success: false,
            error: {
                code: "NOT_IMPLEMENTED",
                message: "This endpoint is not yet implemented",
            },
        }, 501);
    });

    // GET /api/v1/analytics/summary - 统计概览
    app.get("/summary", async (c) => {
        return c.json({
            success: false,
            error: {
                code: "NOT_IMPLEMENTED",
                message: "This endpoint is not yet implemented",
            },
        }, 501);
    });

    return app;
}
