import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../schema.js";
import type { RunStatsHourlyRecord } from "../../types.js";

/**
 * Run Stats Repository
 *
 * 注意：TimescaleDB 使用连续聚合自动计算统计数据。
 * 此 repository 现在主要作为查询接口，手动更新统计数据的逻辑已移除。
 *
 * 统计数据通过数据库触发器自动写入 run_stats_raw 表，
 * 然后通过连续聚合视图自动计算各级别的统计数据。
 */
export class RunStatsRepository {
    constructor(private db: Kysely<Database>) {}

    /**
     * 获取指定时间范围内的统计数据
     * @param startTime - 开始时间 (ISO 8601)
     * @param endTime - 结束时间 (ISO 8601)
     * @param filters - 过滤条件
     * @param granularity - 时间粒度 (15min, 1h, 1d, 1w, 1m)
     */
    async getStats(
        startTime: string,
        endTime: string,
        filters: { model_name?: string; system?: string },
        granularity: "15min" | "1h" | "1d" | "1w" | "1m" = "1h",
    ): Promise<any[]> {
        // 根据粒度选择表
        const tableName = granularity === "15min" ? "run_stats_15min" :
                         granularity === "1d" ? "run_stats_daily" :
                         granularity === "1w" ? "run_stats_weekly" :
                         granularity === "1m" ? "run_stats_monthly" :
                         "run_stats_hourly";

        const timeColumn = tableName === "run_stats_hourly" ? "stat_hour" : "stat_period";

        let query = this.db
            .selectFrom(tableName as any)
            .selectAll()
            .where(sql`${sql.ref(timeColumn)} >=`, sql`${new Date(startTime)}`)
            .where(sql`${sql.ref(timeColumn)} <=`, sql`${new Date(endTime)}`);

        if (filters.model_name) {
            query = query.where("model_name", "=", filters.model_name);
        }
        if (filters.system) {
            query = query.where("system", "=", filters.system);
        }

        return query.orderBy(sql`${sql.ref(timeColumn)}`, "desc").execute();
    }

    /**
     * 获取最新的统计快照
     */
    async getLatestStats(limit = 24): Promise<any[]> {
        return this.db
            .selectFrom("run_stats_hourly" as any)
            .selectAll()
            .orderBy("stat_hour", "desc")
            .limit(limit)
            .execute();
    }

    /**
     * 手动刷新连续聚合
     * 注意：通常不需要手动刷新，TimescaleDB 会按配置的时间间隔自动刷新
     */
    async refreshContinuousAggregates(): Promise<void> {
        try {
            await sql`CALL refresh_continuous_aggregate('run_stats_hourly', NULL, NULL)`.execute(this.db);
            await sql`CALL refresh_continuous_aggregate('run_stats_15min', NULL, NULL)`.execute(this.db);
            await sql`CALL refresh_continuous_aggregate('run_stats_daily', NULL, NULL)`.execute(this.db);
            await sql`CALL refresh_continuous_aggregate('run_stats_weekly', NULL, NULL)`.execute(this.db);
            await sql`CALL refresh_continuous_aggregate('run_stats_monthly', NULL, NULL)`.execute(this.db);
        } catch (error: any) {
            console.error("Error refreshing continuous aggregates:", error);
            throw error;
        }
    }

    /**
     * 获取连续聚合状态
     */
    async getContinuousAggregateStats(): Promise<any[]> {
        return sql`
            SELECT * FROM timescaledb_information.continuous_aggregate_stats
            ORDER BY view_name
        `.execute(this.db);
    }
}
