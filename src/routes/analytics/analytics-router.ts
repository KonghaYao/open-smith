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

// 时序数据粒度对应的表和聚合间隔
const GRANULARITY_CONFIG: Record<string, { table: string; interval: string }> = {
    "5min": { table: "run_stats_15min", interval: "5 minutes" },
    "15min": { table: "run_stats_15min", interval: "15 minutes" },
    "30min": { table: "run_stats_hourly", interval: "30 minutes" },
    "1h": { table: "run_stats_hourly", interval: "1 hour" },
    "1d": { table: "run_stats_daily", interval: "1 day" },
    "1w": { table: "run_stats_weekly", interval: "1 week" },
    "1m": { table: "run_stats_monthly", interval: "1 month" },
};

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
    avg_tokens: "avg_tokens_per_run",
    avg_ttft_ms: "avg_ttft_ms",
    p95_ttft_ms: "p95_ttft_ms",
    distinct_users: "distinct_users",
};

export function createAnalyticsRouter(db: Kysely<Database>) {
    const app = new Hono();

    // GET /api/v1/analytics/timeseries - 时序数据聚合
    app.get("/timeseries", async (c) => {
        try {
            const query = TimeseriesQuerySchema.parse(c.req.query());
            const config = GRANULARITY_CONFIG[query.granularity];
            const tableName = config.table === "run_stats_15min" ? "run_stats_15min" :
                               config.table === "run_stats_daily" ? "run_stats_daily" :
                               config.table === "run_stats_weekly" ? "run_stats_weekly" :
                               config.table === "run_stats_monthly" ? "run_stats_monthly" :
                               "run_stats_hourly";

            const timeColumn = tableName === "run_stats_hourly" ? "stat_hour" : "stat_period";

            // 构建查询
            let queryBuilder = db
                .selectFrom(tableName as any)
                .select(({ fn }) => [
                    sql`time_bucket('${config.interval}', ${sql.ref(timeColumn)})`.as("time"),
                ]);

            // 添加维度字段
            if (query.dimension) {
                queryBuilder = queryBuilder.select(sql`${sql.ref(query.dimension)}`.as("dimension_value"));
            }

            // 添加指标字段
            const validMetrics = query.metrics.filter(m => METRIC_MAP[m]);
            for (const metric of validMetrics) {
                queryBuilder = queryBuilder.select(sql`${sql.ref(METRIC_MAP[metric])}`.as(metric));
            }

            // 应用过滤条件
            if (query.filters.system?.length) {
                queryBuilder = queryBuilder.where("system", "in", query.filters.system);
            }
            if (query.filters.model_name?.length) {
                queryBuilder = queryBuilder.where("model_name", "in", query.filters.model_name);
            }
            if (query.filters.run_type?.length) {
                queryBuilder = queryBuilder.where("run_type", "in", query.filters.run_type);
            }
            if (query.filters.user_id) {
                queryBuilder = queryBuilder.where("user_id", "=", query.filters.user_id);
            }

            // 时间范围过滤
            if (query.start_time) {
                queryBuilder = queryBuilder.where(sql`${sql.ref(timeColumn)} >=`, sql`${new Date(query.start_time)}`);
            }
            if (query.end_time) {
                queryBuilder = queryBuilder.where(sql`${sql.ref(timeColumn)} <=`, sql`${new Date(query.end_time)}`);
            }

            // 分组
            if (query.dimension) {
                queryBuilder = queryBuilder.groupBy([
                    sql`time_bucket('${config.interval}', ${sql.ref(timeColumn)})`,
                    sql`${sql.ref(query.dimension)}`,
                ]);
            } else {
                queryBuilder = queryBuilder.groupBy([
                    sql`time_bucket('${config.interval}', ${sql.ref(timeColumn)})`,
                ]);
            }

            // 排序和分页
            queryBuilder = queryBuilder
                .orderBy("time")
                .limit(query.limit)
                .offset(query.offset);

            const results = await queryBuilder.execute();

            // 格式化返回数据
            const data = results.map((row: any) => {
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
                    item.metrics[metric] = row[metric] ?? null;
                }

                return item;
            });

            // 获取总数（简化版本，实际应该单独查询）
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

            // 查询当前周期数据
            const currentResult = await db
                .selectFrom("run_stats_hourly" as any)
                .select((eb) => [sql`COALESCE(AVG(${sql.ref(METRIC_MAP[query.metric])}), 0)`.as("value")])
                .where(sql`stat_hour >=`, sql`${startTime}`)
                .where(sql`stat_hour <=`, sql`${endTime}`)
                .executeTakeFirst();

            // 查询前一个周期数据
            const previousResult = await db
                .selectFrom("run_stats_hourly" as any)
                .select((eb) => [sql`COALESCE(AVG(${sql.ref(METRIC_MAP[query.metric])}), 0)`.as("value")])
                .where(sql`stat_hour >=`, sql`${previousStartTime}`)
                .where(sql`stat_hour <=`, sql`${previousEndTime}`)
                .executeTakeFirst();

            const currentValue = Number(currentResult?.value ?? 0);
            const previousValue = Number(previousResult?.value ?? 0);
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
        try {
            const query = CompareQuerySchema.parse(c.req.query());

            // 计算第二个时间范围（如果未提供，使用上一个周期）
            let start2 = query.start_time_2 ? new Date(query.start_time_2) : new Date(new Date(query.start_time_1).getTime() - (new Date(query.end_time_1).getTime() - new Date(query.start_time_1).getTime()));
            let end2 = query.end_time_2 ? new Date(query.end_time_2) : new Date(query.start_time_1);

            // 根据对比维度查询
            const results = [];

            if (query.compare_by === "model") {
                // 获取所有模型
                const models = await db
                    .selectFrom("runs" as any)
                    .select("model_name")
                    .where("model_name", "is not", null)
                    .distinct()
                    .execute();

                for (const model of models) {
                    if (!model.model_name) continue;

                    // 查询第一个时间段
                    const period1 = await db
                        .selectFrom("run_stats_hourly" as any)
                        .select((eb) => {
                            const selections: any[] = [];
                            for (const metric of query.metrics) {
                                if (METRIC_MAP[metric]) {
                                    selections.push(sql`COALESCE(AVG(${sql.ref(METRIC_MAP[metric])}), 0)`.as(metric));
                                }
                            }
                            return selections;
                        })
                        .where("model_name", "=", model.model_name)
                        .where(sql`stat_hour >=`, sql`${new Date(query.start_time_1)}`)
                        .where(sql`stat_hour <=`, sql`${new Date(query.end_time_1)}`)
                        .executeTakeFirst();

                    // 查询第二个时间段
                    const period2 = await db
                        .selectFrom("run_stats_hourly" as any)
                        .select((eb) => {
                            const selections: any[] = [];
                            for (const metric of query.metrics) {
                                if (METRIC_MAP[metric]) {
                                    selections.push(sql`COALESCE(AVG(${sql.ref(METRIC_MAP[metric])}), 0)`.as(metric));
                                }
                            }
                            return selections;
                        })
                        .where("model_name", "=", model.model_name)
                        .where(sql`stat_hour >=`, sql`${start2}`)
                        .where(sql`stat_hour <=`, sql`${end2}`)
                        .executeTakeFirst();

                    const item: any = {
                        dimension: { model_name: model.model_name },
                    };

                    item.period_1 = {};
                    item.period_2 = {};
                    item.diff = {};

                    for (const metric of query.metrics) {
                        if (METRIC_MAP[metric]) {
                            const val1 = Number(period1?.[metric] ?? 0);
                            const val2 = Number(period2?.[metric] ?? 0);
                            item.period_1[metric] = val1;
                            item.period_2[metric] = val2;
                            item.diff[metric] = val1 - val2;
                        }
                    }

                    results.push(item);
                }
            } else if (query.compare_by === "system") {
                // 获取所有系统
                const systems = await db
                    .selectFrom("runs" as any)
                    .select("system")
                    .where("system", "is not", null)
                    .distinct()
                    .execute();

                for (const sys of systems) {
                    if (!sys.system) continue;

                    // 查询第一个时间段
                    const period1 = await db
                        .selectFrom("run_stats_hourly" as any)
                        .select((eb) => {
                            const selections: any[] = [];
                            for (const metric of query.metrics) {
                                if (METRIC_MAP[metric]) {
                                    selections.push(sql`COALESCE(AVG(${sql.ref(METRIC_MAP[metric])}), 0)`.as(metric));
                                }
                            }
                            return selections;
                        })
                        .where("system", "=", sys.system)
                        .where(sql`stat_hour >=`, sql`${new Date(query.start_time_1)}`)
                        .where(sql`stat_hour <=`, sql`${new Date(query.end_time_1)}`)
                        .executeTakeFirst();

                    // 查询第二个时间段
                    const period2 = await db
                        .selectFrom("run_stats_hourly" as any)
                        .select((eb) => {
                            const selections: any[] = [];
                            for (const metric of query.metrics) {
                                if (METRIC_MAP[metric]) {
                                    selections.push(sql`COALESCE(AVG(${sql.ref(METRIC_MAP[metric])}), 0)`.as(metric));
                                }
                            }
                            return selections;
                        })
                        .where("system", "=", sys.system)
                        .where(sql`stat_hour >=`, sql`${start2}`)
                        .where(sql`stat_hour <=`, sql`${end2}`)
                        .executeTakeFirst();

                    const item: any = {
                        dimension: { system: sys.system },
                    };

                    item.period_1 = {};
                    item.period_2 = {};
                    item.diff = {};

                    for (const metric of query.metrics) {
                        if (METRIC_MAP[metric]) {
                            const val1 = Number(period1?.[metric] ?? 0);
                            const val2 = Number(period2?.[metric] ?? 0);
                            item.period_1[metric] = val1;
                            item.period_2[metric] = val2;
                            item.diff[metric] = val1 - val2;
                        }
                    }

                    results.push(item);
                }
            }

            return c.json({
                success: true,
                data: results,
            });
        } catch (error: any) {
            console.error("Error in /compare:", error);
            return c.json({
                success: false,
                error: {
                    code: "ANALYTICS_ERROR",
                    message: error.message || "Failed to compare performance",
                },
            }, 500);
        }
    });

    // GET /api/v1/analytics/anomalies - 异常检测
    app.get("/anomalies", async (c) => {
        try {
            const query = AnomalyQuerySchema.parse(c.req.query());

            const startTime = new Date(query.start_time);
            const endTime = new Date(query.end_time);

            // 查询指定时间段内的数据点
            const dataPoints = await db
                .selectFrom("run_stats_hourly" as any)
                .select(sql`${sql.ref(METRIC_MAP[query.metric])} as value, stat_hour as time`)
                .where(sql`stat_hour >=`, sql`${startTime}`)
                .where(sql`stat_hour <=`, sql`${endTime}`)
                .orderBy("stat_hour")
                .execute();

            if (dataPoints.length === 0) {
                return c.json({
                    success: true,
                    data: {
                        metric: query.metric,
                        baseline: null,
                        anomalies: [],
                    },
                });
            }

            // 计算统计指标
            const values = dataPoints.map((d: any) => Number(d.value)).filter((v: number) => !isNaN(v));
            const mean = values.reduce((sum: number, v: number) => sum + v, 0) / values.length;
            const variance = values.reduce((sum: number, v: number) => sum + Math.pow(v - mean, 2), 0) / values.length;
            const stddev = Math.sqrt(variance);

            const upperThreshold = mean + query.threshold * stddev;
            const lowerThreshold = mean - query.threshold * stddev;

            // 检测异常
            const anomalies = [];
            for (const point of dataPoints) {
                const value = Number(point.value);
                if (isNaN(value)) continue;

                const zScore = (value - mean) / stddev;
                const severity = Math.abs(zScore) >= query.threshold * 1.5 ? "high" :
                               Math.abs(zScore) >= query.threshold * 1.2 ? "medium" : "low";

                if (Math.abs(zScore) >= query.threshold) {
                    anomalies.push({
                        time: new Date(point.time).toISOString(),
                        value,
                        z_score: Math.round(zScore * 100) / 100,
                        severity,
                    });
                }
            }

            return c.json({
                success: true,
                data: {
                    metric: query.metric,
                    baseline: {
                        mean: Math.round(mean * 100) / 100,
                        stddev: Math.round(stddev * 100) / 100,
                        upper_threshold: Math.round(upperThreshold * 100) / 100,
                        lower_threshold: Math.round(lowerThreshold * 100) / 100,
                    },
                    anomalies,
                },
            });
        } catch (error: any) {
            console.error("Error in /anomalies:", error);
            return c.json({
                success: false,
                error: {
                    code: "ANALYTICS_ERROR",
                    message: error.message || "Failed to detect anomalies",
                },
            }, 500);
        }
    });

    // GET /api/v1/analytics/summary - 统计概览
    app.get("/summary", async (c) => {
        try {
            const query = SummaryQuerySchema.parse(c.req.query());

            // 默认时间范围：最近 24 小时
            let endTime = new Date();
            let startTime = query.end_time ? new Date(query.end_time) : endTime;
            if (query.start_time) {
                startTime = new Date(query.start_time);
            } else {
                startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
            }

            // 查询运行统计
            const runsStats = await db
                .selectFrom("run_stats_hourly" as any)
                .select((eb) => [
                    sql`SUM(total_runs)`.as("total_runs"),
                    sql`SUM(successful_runs)`.as("successful_runs"),
                    sql`SUM(failed_runs)`.as("failed_runs"),
                    sql`AVG(avg_duration_ms)`.as("avg_duration_ms"),
                    sql`AVG(p95_duration_ms)`.as("p95_duration_ms"),
                    sql`AVG(p99_duration_ms)`.as("p99_duration_ms"),
                    sql`SUM(total_tokens_sum)`.as("total_tokens_sum"),
                    sql`AVG(avg_tokens_per_run)`.as("avg_tokens_per_run"),
                    sql`AVG(avg_ttft_ms)`.as("avg_ttft_ms"),
                    sql`SUM(distinct_users)`.as("total_users"),
                ])
                .where(sql`stat_hour >=`, sql`${startTime}`)
                .where(sql`stat_hour <=`, sql`${endTime}`)
                .executeTakeFirst();

            // 查询 Top 模型
            const topModels = await db
                .selectFrom("run_stats_hourly" as any)
                .select(["model_name", sql`SUM(total_runs)`.as("runs"), sql`AVG(avg_duration_ms)`.as("avg_duration_ms")])
                .where(sql`stat_hour >=`, sql`${startTime}`)
                .where(sql`stat_hour <=`, sql`${endTime}`)
                .groupBy("model_name")
                .orderBy(sql`SUM(total_runs)`, "desc")
                .limit(5)
                .execute();

            const totalRuns = Number(runsStats?.total_runs ?? 0);
            const successfulRuns = Number(runsStats?.successful_runs ?? 0);
            const failedRuns = Number(runsStats?.failed_runs ?? 0);

            return c.json({
                success: true,
                data: {
                    runs: {
                        total: totalRuns,
                        successful: successfulRuns,
                        failed: failedRuns,
                        success_rate: totalRuns > 0 ? successfulRuns / totalRuns : 0,
                    },
                    performance: {
                        avg_duration_ms: Number(runsStats?.avg_duration_ms ?? 0),
                        p95_duration_ms: Number(runsStats?.p95_duration_ms ?? 0),
                        p99_duration_ms: Number(runsStats?.p99_duration_ms ?? 0),
                        avg_ttft_ms: Number(runsStats?.avg_ttft_ms ?? 0),
                    },
                    tokens: {
                        total: Number(runsStats?.total_tokens_sum ?? 0),
                        avg_per_run: Number(runsStats?.avg_tokens_per_run ?? 0),
                    },
                    users: {
                        distinct: Number(runsStats?.total_users ?? 0),
                    },
                    top_models: topModels.map((m: any) => ({
                        model_name: m.model_name,
                        runs: Number(m.runs ?? 0),
                        avg_duration_ms: Number(m.avg_duration_ms ?? 0),
                    })),
                },
            });
        } catch (error: any) {
            console.error("Error in /summary:", error);
            return c.json({
                success: false,
                error: {
                    code: "ANALYTICS_ERROR",
                    message: error.message || "Failed to get summary",
                },
            }, 500);
        }
    });

    return app;
}
