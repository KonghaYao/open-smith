import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../schema.js";
import type { RunStatsHourlyRecord } from "../../types.js";

type RunForStats = {
    model_name: string | null;
    system: string | null;
    error: string | null;
    start_time: string;
    end_time: string;
    total_tokens: number | null;
    time_to_first_token: number | null;
    user_id: string | null;
};

export class RunStatsRepository {
    constructor(private db: Kysely<Database>) {}

    /**
     * 更新指定小时的运行统计数据
     * @param specificHour - "YYYY-MM-DDTHH:00:00.000Z"
     */
    async updateHourlyStats(specificHour: string): Promise<void> {
        await this.db.transaction().execute(async (trx) => {
            // 获取指定小时内的所有 runs
            const runs = await this.getRunsForHour(specificHour, trx);
            if (runs.length === 0) return;

            // 按维度分组
            const groupedRuns = this.groupRuns(runs);

            // 计算并插入/更新统计数据
            for (const key in groupedRuns) {
                const group = groupedRuns[key];
                const stats = this.calculateStatsForGroup(
                    group,
                    specificHour,
                    key,
                );
                await this.upsertStats(stats, trx);
            }
        });
    }

    private async getRunsForHour(
        hour: string,
        trx: Kysely<Database>,
    ): Promise<RunForStats[]> {
        const startTime = new Date(hour).getTime();
        const endTime = startTime + 60 * 60 * 1000;

        const results = await trx
            .selectFrom("runs")
            .select([
                "model_name",
                "system",
                "error",
                "start_time",
                "end_time",
                "total_tokens",
                "time_to_first_token",
                "user_id",
            ])
            .where("start_time", ">=", startTime.toString())
            .where("start_time", "<", endTime.toString())
            .execute();

        return results as RunForStats[];
    }

    private normalizeDimension(
        value: string | null | undefined,
    ): string | null {
        if (
            value === null ||
            value === undefined ||
            value === "" ||
            value === "N/A"
        ) {
            return null;
        }
        return value;
    }

    private groupRuns(runs: RunForStats[]): Record<string, RunForStats[]> {
        return runs.reduce((acc, run) => {
            const modelName = this.normalizeDimension(run.model_name);

            // 忽略没有 model_name 的运行
            if (!modelName) {
                return acc;
            }

            const system = this.normalizeDimension(run.system);

            const key = `${modelName}|${system || "null"}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(run);
            return acc;
        }, {} as Record<string, RunForStats[]>);
    }

    private calculateStatsForGroup(
        group: RunForStats[],
        statHour: string,
        key: string,
    ): RunStatsHourlyRecord {
        const total_runs = group.length;
        const failed_runs = group.filter((r) => r.error).length;
        const successful_runs = total_runs - failed_runs;
        const error_rate = total_runs > 0 ? failed_runs / total_runs : 0;

        const durations = group.map(
            (r) => parseInt(r.end_time) - parseInt(r.start_time),
        );
        const total_duration_ms = durations.reduce((a, b) => a + b, 0);
        const avg_duration_ms =
            total_runs > 0 ? total_duration_ms / total_runs : 0;

        const ttfts = group.map((r) => r.time_to_first_token || 0);
        const total_ttft_ms = ttfts.reduce((a, b) => a + b, 0);
        const avg_ttft_ms = ttfts.length > 0 ? total_ttft_ms / ttfts.length : 0;

        const total_tokens_sum = group.reduce(
            (sum, r) => sum + (r.total_tokens || 0),
            0,
        );
        const avg_tokens_per_run =
            total_runs > 0 ? total_tokens_sum / total_runs : 0;

        const distinct_users = new Set(
            group.map((r) => r.user_id).filter(Boolean),
        ).size;

        // 计算百分位
        durations.sort((a, b) => a - b);
        ttfts.sort((a, b) => a - b);
        const p95_duration_ms =
            durations[Math.floor(0.95 * durations.length)] || 0;
        const p99_duration_ms =
            durations[Math.floor(0.99 * durations.length)] || 0;
        const p95_ttft_ms = ttfts[Math.floor(0.95 * ttfts.length)] || 0;

        const [model_name, system] = key.split("|");

        return {
            stat_hour: statHour,
            model_name: model_name,
            system: system === "null" ? null : system,
            total_runs,
            successful_runs,
            failed_runs,
            error_rate,
            total_duration_ms,
            avg_duration_ms: Math.round(avg_duration_ms),
            p95_duration_ms,
            p99_duration_ms,
            total_tokens_sum,
            avg_tokens_per_run,
            avg_ttft_ms: Math.round(avg_ttft_ms),
            p95_ttft_ms,
            distinct_users,
        };
    }

    private async upsertStats(
        stats: RunStatsHourlyRecord,
        trx: Kysely<Database>,
    ): Promise<void> {
        // 使用 INSERT ... ON CONFLICT 语法
        await sql`
            INSERT INTO run_stats_hourly (
                stat_hour, model_name, system,
                total_runs, successful_runs, failed_runs, error_rate,
                total_duration_ms, avg_duration_ms, p95_duration_ms, p99_duration_ms,
                total_tokens_sum, avg_tokens_per_run, avg_ttft_ms, p95_ttft_ms,
                distinct_users
            ) VALUES (
                ${stats.stat_hour}, 
                ${stats.model_name}, 
                ${stats.system}, 
                ${stats.total_runs}, 
                ${stats.successful_runs}, 
                ${stats.failed_runs}, 
                ${stats.error_rate}, 
                ${stats.total_duration_ms}, 
                ${stats.avg_duration_ms}, 
                ${stats.p95_duration_ms}, 
                ${stats.p99_duration_ms}, 
                ${stats.total_tokens_sum}, 
                ${stats.avg_tokens_per_run}, 
                ${stats.avg_ttft_ms}, 
                ${stats.p95_ttft_ms}, 
                ${stats.distinct_users}
            )
            ON CONFLICT(stat_hour, model_name, system) DO UPDATE SET
                total_runs = ${stats.total_runs},
                successful_runs = ${stats.successful_runs},
                failed_runs = ${stats.failed_runs},
                error_rate = ${stats.error_rate},
                total_duration_ms = ${stats.total_duration_ms},
                avg_duration_ms = ${stats.avg_duration_ms},
                p95_duration_ms = ${stats.p95_duration_ms},
                p99_duration_ms = ${stats.p99_duration_ms},
                total_tokens_sum = ${stats.total_tokens_sum},
                avg_tokens_per_run = ${stats.avg_tokens_per_run},
                avg_ttft_ms = ${stats.avg_ttft_ms},
                p95_ttft_ms = ${stats.p95_ttft_ms},
                distinct_users = ${stats.distinct_users}
        `.execute(trx);
    }

    private async ensureStatsForHour(hour: string): Promise<void> {
        // 检查该小时是否已经有任何统计数据
        const result = await this.db
            .selectFrom("run_stats_hourly")
            .select(({ fn }) => [fn.count<number>("stat_hour").as("count")])
            .where("stat_hour", "=", hour)
            .executeTakeFirst();

        const existingCount = Number(result?.count ?? 0);

        if (existingCount === 0) {
            console.log(`Updating stats for hour: ${hour}`);
            await this.updateHourlyStats(hour);
        }
    }

    /**
     * 获取指定时间范围内的统计数据
     */
    async getStats(
        startTime: string,
        endTime: string,
        filters: { model_name?: string; system?: string },
    ): Promise<RunStatsHourlyRecord[]> {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const now = new Date();

        // 将 start time 对齐到小时的开始
        start.setUTCMinutes(0, 0, 0);

        // 排除当前正在进行的小时，只统计已完成的小时
        const effectiveEnd = new Date(Math.min(end.getTime(), now.getTime()));
        // 将结束时间对齐到小时的开始，这样就不会包含当前正在进行的小时
        effectiveEnd.setUTCMinutes(0, 0, 0);

        const current = new Date(start);

        while (current < effectiveEnd) {
            const hourString = current.toISOString();
            await this.ensureStatsForHour(hourString);
            current.setUTCHours(current.getUTCHours() + 1);
        }

        let query = this.db
            .selectFrom("run_stats_hourly")
            .selectAll()
            .where("stat_hour", ">=", startTime)
            .where("stat_hour", "<", effectiveEnd.toISOString());

        if (filters.model_name) {
            query = query.where("model_name", "=", filters.model_name);
        }
        if (filters.system) {
            query = query.where("system", "=", filters.system);
        }

        const results = await query.orderBy("stat_hour", "desc").execute();

        return results.map((r) => ({
            ...r,
            system: r.system ?? null,
            error_rate: r.error_rate ?? -1,
            total_duration_ms: r.total_duration_ms ?? -1,
            avg_duration_ms: r.avg_duration_ms ?? -1,
            p95_duration_ms: r.p95_duration_ms ?? -1,
            p99_duration_ms: r.p99_duration_ms ?? -1,
            total_tokens_sum: r.total_tokens_sum ?? -1,
            avg_tokens_per_run: r.avg_tokens_per_run ?? -1,
            avg_ttft_ms: r.avg_ttft_ms ?? -1,
            p95_ttft_ms: r.p95_ttft_ms ?? -1,
            distinct_users: r.distinct_users ?? -1,
        }));
    }
}
