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

// 指标名称映射：前端指标 -> 数据库列名
const METRIC_MAP: Record<string, string> = {
    total_runs: "total_runs",
    successful_runs: "successful_runs",
    failed_runs: "failed_runs",
    error_rate: "error_rate",
    avg_duration_ms: "avg_duration_ms",
    p95_duration_ms: "p95_duration_ms",
    p99_duration_ms: "p99_duration_ms",
    total_tokens: "total_tokens_sum",        // 映射到 total_tokens_sum
    total_tokens_sum: "total_tokens_sum",    // 保留兼容
    avg_tokens: "avg_tokens_per_run",        // 映射到 avg_tokens_per_run
    avg_tokens_per_run: "avg_tokens_per_run",
    avg_ttft_ms: "avg_ttft_ms",
    p95_ttft_ms: "p95_ttft_ms",
    distinct_users: "distinct_users",
};

// 连续聚合视图的分组配置
const AGGREGATE_GROUPING: Record<string, string> = {
    "run_stats_hourly": "(stat_hour, model_name, system)",
    "run_stats_15min": "(stat_period, model_name, system)",
    "run_stats_daily": "(stat_period, model_name, system)",
    "run_stats_weekly": "(stat_period, model_name, system)",
    "run_stats_monthly": "(stat_period, model_name, system)",
};

// 粒度到表名和列名的映射
const GRANULARITY_CONFIG: Record<string, { table: string; timeColumn: string }> = {
    "5min": { table: "run_stats_15min", timeColumn: "stat_period" },
    "15min": { table: "run_stats_15min", timeColumn: "stat_period" },
    "30min": { table: "run_stats_hourly", timeColumn: "stat_hour" },
    "1h": { table: "run_stats_hourly", timeColumn: "stat_hour" },
    "1d": { table: "run_stats_daily", timeColumn: "stat_period" },
    "1w": { table: "run_stats_weekly", timeColumn: "stat_period" },
    "1m": { table: "run_stats_monthly", timeColumn: "stat_period" },
};

export function createAnalyticsRouter(db: Kysely<Database>) {
    const app = new Hono();

    // GET /api/v1/analytics/timeseries - 时序数据聚合
    app.get("/timeseries", async (c) => {
        try {
            const query = TimeseriesQuerySchema.parse(c.req.query());

            // 根据粒度选择表和列名
            const config = GRANULARITY_CONFIG[query.granularity];
            const tableName = config.table;
            const timeColumn = config.timeColumn;

            // 过滤并映射指标名称
            const validMetrics = query.metrics
                .filter(m => m !== "")
                .map(m => METRIC_MAP[m] || m); // 使用映射后的列名

            const hasDimension = !!query.dimension;
            const dimensionColumn = query.dimension || "null";

            // 构建 WHERE 子句
            const whereConditions: string[] = [];

            if (query.filters.system?.length) {
                whereConditions.push(`system IN ('${query.filters.system.join("','")}')`);
            }
            if (query.filters.model_name?.length) {
                whereConditions.push(`model_name IN ('${query.filters.model_name.join("','")}')`);
            }
            if (query.filters.user_id) {
                // 连续聚合表中没有 user_id 维度，需要降级到 run_stats_raw
                return c.json({
                    success: false,
                    error: {
                        code: "UNSUPPORTED_FILTER",
                        message: "Filtering by user_id is not supported with pre-aggregated data",
                    },
                }, 400);
            }

            if (query.start_time) {
                whereConditions.push(`${timeColumn} >= '${new Date(query.start_time).toISOString()}'`);
            }
            if (query.end_time) {
                whereConditions.push(`${timeColumn} <= '${new Date(query.end_time).toISOString()}'`);
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

            // 构建 ORDER BY 和 LIMIT
            const orderByClause = `ORDER BY ${timeColumn}`;
            const limitClause = `LIMIT ${query.limit} OFFSET ${query.offset}`;

            // 构建指标聚合表达式
            const metricClauses: string[] = validMetrics.map(metric => {
                // 如果有维度分组，需要 SUM；否则直接选择
                return hasDimension ? `SUM(${metric}) as ${metric}` : metric;
            });

            const metricSelect = metricClauses.join(", ");

            // 完整的 SQL 查询字符串 - 直接查询，避免不必要的子查询
            let fullSql: string;

            if (hasDimension) {
                // 有维度分组时：直接按时间和维度分组查询
                fullSql = `
                    SELECT
                        ${timeColumn} as time,
                        ${dimensionColumn} as dimension_value,
                        ${metricSelect}
                    FROM ${tableName}
                    ${whereClause}
                    GROUP BY ${timeColumn}, ${dimensionColumn}
                    ${orderByClause}
                    ${limitClause}
                `;
            } else {
                // 无维度分组时：直接查询
                fullSql = `
                    SELECT
                        ${timeColumn} as time,
                        ${metricSelect}
                    FROM ${tableName}
                    ${whereClause}
                    ${orderByClause}
                    ${limitClause}
                `;
            }

            console.log(`Executing analytics query on ${tableName}:`, fullSql);

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

                // 将数据库列名映射回前端指标名
                item.metrics = {};
                query.metrics.forEach(metric => {
                    if (metric !== "") {
                        const dbColumn = METRIC_MAP[metric] || metric;
                        item.metrics[metric] = row[dbColumn] ?? null;
                    }
                });

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

            // 映射指标名称
            const dbMetric = METRIC_MAP[query.metric] || query.metric;

            // 根据指标类型确定聚合函数
            // count 类指标使用 SUM, avg 和 百分位类指标使用 AVG
            const countMetrics = [
                "total_runs",
                "successful_runs",
                "failed_runs",
                "total_tokens"
            ];
            const aggregateFunction = countMetrics.includes(query.metric) ? "SUM" : "AVG";

            // 构建 WHERE 条件
            const whereConditions: string[] = [];
            if (query.filters.system?.length) {
                whereConditions.push(`system IN ('${query.filters.system.join("','")}')`);
            }
            if (query.filters.model_name?.length) {
                whereConditions.push(`model_name IN ('${query.filters.model_name.join("','")}')`);
            }
            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

            // 查询当前周期数据 - 使用聚合函数处理多个时间桶
            const currentSql = `
                SELECT COALESCE(${aggregateFunction}(${dbMetric}), 0) as value
                FROM run_stats_hourly
                ${whereClause}
                AND stat_hour >= '${startTime.toISOString()}'
                AND stat_hour <= '${endTime.toISOString()}'
            `;
            const currentResult = await sql.raw(currentSql).execute(db);

            // 查询前一个周期数据 - 使用聚合函数处理多个时间桶
            const previousSql = `
                SELECT COALESCE(${aggregateFunction}(${dbMetric}), 0) as value
                FROM run_stats_hourly
                ${whereClause}
                AND stat_hour >= '${previousStartTime.toISOString()}'
                AND stat_hour <= '${previousEndTime.toISOString()}'
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
