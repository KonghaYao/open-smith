import type { DatabaseAdapter } from "../interfaces.js";
import type { RunStatsHourlyRecord } from "../../types.js";

export class RunStatsRepository {
    constructor(private adapter: DatabaseAdapter) {}

    /**
     * 更新指定小时的运行统计数据
     * @param specificHour - "YYYY-MM-DDTHH:00:00.000Z"
     */
    async updateHourlyStats(specificHour: string): Promise<void> {
        const transaction = await this.adapter.transaction(async () => {
            // 获取指定小时内的所有 runs
            const runs = await this.getRunsForHour(specificHour);
            if (runs.length === 0) return;

            // 按维度分组
            const groupedRuns = this.groupRuns(runs);

            // 计算并插入/更新统计数据
            for (const key in groupedRuns) {
                const group = groupedRuns[key];
                const stats = this.calculateStatsForGroup(
                    group,
                    specificHour,
                    key
                );
                await this.upsertStats(stats);
            }
        });
        await transaction();
    }

    private async getRunsForHour(hour: string): Promise<any[]> {
        const startTime = new Date(hour).getTime();
        const endTime = startTime + 60 * 60 * 1000;

        const stmt = await this.adapter.prepare(`
            SELECT model_name, system, error, start_time, end_time, total_tokens, time_to_first_token, user_id
            FROM runs
            WHERE start_time >= ${this.adapter.getPlaceholder(
                1
            )} AND start_time < ${this.adapter.getPlaceholder(2)}
        `);

        return stmt.all([startTime.toString(), endTime.toString()]);
    }

    private normalizeDimension(
        value: string | null | undefined
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

    private groupRuns(runs: any[]): Record<string, any[]> {
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
        }, {});
    }

    private calculateStatsForGroup(
        group: any[],
        statHour: string,
        key: string
    ): RunStatsHourlyRecord {
        const total_runs = group.length;
        const failed_runs = group.filter((r) => r.error).length;
        const successful_runs = total_runs - failed_runs;
        const error_rate = total_runs > 0 ? failed_runs / total_runs : 0;

        const durations = group.map(
            (r) => parseInt(r.end_time) - parseInt(r.start_time)
        );
        const total_duration_ms = durations.reduce((a, b) => a + b, 0);
        const avg_duration_ms =
            total_runs > 0 ? total_duration_ms / total_runs : 0;

        const ttfts = group.map((r) => r.time_to_first_token || 0);
        const total_ttft_ms = ttfts.reduce((a, b) => a + b, 0);
        const avg_ttft_ms = ttfts.length > 0 ? total_ttft_ms / ttfts.length : 0;

        const total_tokens_sum = group.reduce(
            (sum, r) => sum + (r.total_tokens || 0),
            0
        );
        const avg_tokens_per_run =
            total_runs > 0 ? total_tokens_sum / total_runs : 0;

        const distinct_users = new Set(
            group.map((r) => r.user_id).filter(Boolean)
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

    private async upsertStats(stats: RunStatsHourlyRecord): Promise<void> {
        const stmt = await this.adapter.prepare(`
            INSERT INTO run_stats_hourly (
                stat_hour, model_name, system,
                total_runs, successful_runs, failed_runs, error_rate,
                total_duration_ms, avg_duration_ms, p95_duration_ms, p99_duration_ms,
                total_tokens_sum, avg_tokens_per_run, avg_ttft_ms, p95_ttft_ms,
                distinct_users
            ) VALUES (
                ${this.adapter.getPlaceholder(1)}, 
                ${this.adapter.getPlaceholder(2)}, 
                ${this.adapter.getPlaceholder(3)}, 
                ${this.adapter.getPlaceholder(4)}, 
                ${this.adapter.getPlaceholder(5)}, 
                ${this.adapter.getPlaceholder(6)}, 
                ${this.adapter.getPlaceholder(7)}, 
                ${this.adapter.getPlaceholder(8)}, 
                ${this.adapter.getPlaceholder(9)}, 
                ${this.adapter.getPlaceholder(10)}, 
                ${this.adapter.getPlaceholder(11)}, 
                ${this.adapter.getPlaceholder(12)}, 
                ${this.adapter.getPlaceholder(13)}, 
                ${this.adapter.getPlaceholder(14)}, 
                ${this.adapter.getPlaceholder(15)}, 
                ${this.adapter.getPlaceholder(16)}
            )
            ON CONFLICT(stat_hour, run_type, model_name, system) DO UPDATE SET
                total_runs = ${this.adapter.getPlaceholder(17)},
                successful_runs = ${this.adapter.getPlaceholder(18)},
                failed_runs = ${this.adapter.getPlaceholder(19)},
                error_rate = ${this.adapter.getPlaceholder(20)},
                total_duration_ms = ${this.adapter.getPlaceholder(21)},
                avg_duration_ms = ${this.adapter.getPlaceholder(22)},
                p95_duration_ms = ${this.adapter.getPlaceholder(23)},
                p99_duration_ms = ${this.adapter.getPlaceholder(24)},
                total_tokens_sum = ${this.adapter.getPlaceholder(25)},
                avg_tokens_per_run = ${this.adapter.getPlaceholder(26)},
                avg_ttft_ms = ${this.adapter.getPlaceholder(27)},
                p95_ttft_ms = ${this.adapter.getPlaceholder(28)},
                distinct_users = ${this.adapter.getPlaceholder(29)}
        `);
        await stmt.run([
            stats.stat_hour,
            stats.model_name,
            stats.system,
            stats.total_runs,
            stats.successful_runs,
            stats.failed_runs,
            stats.error_rate,
            stats.total_duration_ms,
            stats.avg_duration_ms,
            stats.p95_duration_ms,
            stats.p99_duration_ms,
            stats.total_tokens_sum,
            stats.avg_tokens_per_run,
            stats.avg_ttft_ms,
            stats.p95_ttft_ms,
            stats.distinct_users,
            stats.total_runs,
            stats.successful_runs,
            stats.failed_runs,
            stats.error_rate,
            stats.total_duration_ms,
            stats.avg_duration_ms,
            stats.p95_duration_ms,
            stats.p99_duration_ms,
            stats.total_tokens_sum,
            stats.avg_tokens_per_run,
            stats.avg_ttft_ms,
            stats.p95_ttft_ms,
            stats.distinct_users,
        ]);
    }

    private async ensureStatsForHour(hour: string): Promise<void> {
        const existingStmt = await this.adapter.prepare(`
            SELECT 1 FROM run_stats_hourly WHERE stat_hour = ${this.adapter.getPlaceholder(
                1
            )} LIMIT 1
        `);
        const existing = await existingStmt.get([hour]);

        if (!existing) {
            await this.updateHourlyStats(hour);
        }
    }

    /**
     * 获取指定时间范围内的统计数据
     */
    async getStats(
        startTime: string,
        endTime: string,
        filters: { model_name?: string; system?: string }
    ): Promise<RunStatsHourlyRecord[]> {
        const start = new Date(startTime);
        const end = new Date(endTime);

        // 将 start time 对齐到小时的开始
        start.setUTCMinutes(0, 0, 0);

        const promises: Promise<void>[] = [];
        const current = new Date(start);

        while (current < end) {
            const hourString = current.toISOString();
            promises.push(this.ensureStatsForHour(hourString));
            current.setUTCHours(current.getUTCHours() + 1);
        }

        await Promise.all(promises);

        let paramIndex = 1;
        const where: string[] = [
            `stat_hour >= ${this.adapter.getPlaceholder(paramIndex++)}`,
            `stat_hour < ${this.adapter.getPlaceholder(paramIndex++)}`,
        ];
        const params: any[] = [startTime, endTime];

        if (filters.model_name) {
            where.push(
                `model_name = ${this.adapter.getPlaceholder(paramIndex++)}`
            );
            params.push(filters.model_name);
        }
        if (filters.system) {
            where.push(`system = ${this.adapter.getPlaceholder(paramIndex++)}`);
            params.push(filters.system);
        }

        const stmt = await this.adapter.prepare(`
            SELECT * FROM run_stats_hourly
            WHERE ${where.join(" AND ")}
            ORDER BY stat_hour DESC
        `);

        return stmt.all(params);
    }
}
