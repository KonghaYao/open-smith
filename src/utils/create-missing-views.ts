/**
 * 创建缺失的连续聚合视图
 */

import { createKyselyInstance } from "../database/kysely-dialects.js";
import { sql } from "kysely";

export async function createMissingViews() {
    const kysely = await createKyselyInstance({
        connectionString: process.env.TRACE_DATABASE_URL!,
    });

    console.log("=== 创建缺失的连续聚合视图 ===\n");

    // 创建天级聚合视图
    console.log("1. 创建 run_stats_daily...");
    try {
        await sql`
            CREATE MATERIALIZED VIEW IF NOT EXISTS run_stats_daily
            WITH (timescaledb.continuous)
            AS
            SELECT
                time_bucket('1 day', start_time) AS stat_period,
                model_name,
                system,
                COUNT(*) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS total_runs,
                SUM(CASE WHEN (run_type = 'llm' OR run_type IS NULL) AND error IS NULL THEN 1 ELSE 0 END) AS successful_runs,
                SUM(CASE WHEN (run_type = 'llm' OR run_type IS NULL) AND error IS NOT NULL THEN 1 ELSE 0 END) AS failed_runs,
                (SUM(CASE WHEN (run_type = 'llm' OR run_type IS NULL) AND error IS NOT NULL THEN 1 ELSE 0 END)::FLOAT /
                 NULLIF(SUM(CASE WHEN run_type = 'llm' OR run_type IS NULL THEN 1 ELSE 0 END), 0)) AS error_rate,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS total_duration_ms,
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS avg_duration_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS p95_duration_ms,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS p99_duration_ms,
                SUM(total_tokens) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS total_tokens_sum,
                AVG(total_tokens) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS avg_tokens_per_run,
                AVG(time_to_first_token) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS avg_ttft_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY time_to_first_token)
                    FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS p95_ttft_ms,
                COUNT(DISTINCT user_id) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS distinct_users
            FROM runs
            GROUP BY time_bucket('1 day', start_time), model_name, system
        `.execute(kysely);
        console.log("   ✓ run_stats_daily 创建成功");

        // 配置刷新策略（使用更宽松的窗口配置）
        try {
            await sql`
                SELECT add_continuous_aggregate_policy('run_stats_daily',
                    start_offset => INTERVAL '1 day',
                    end_offset => INTERVAL '5 minutes',
                    schedule_interval => INTERVAL '30 minutes',
                    if_not_exists => TRUE
                )
            `.execute(kysely);
            console.log("   ✓ run_stats_daily 刷新策略配置成功");
        } catch (policyError: any) {
            console.log(
                `   ⚠️  run_stats_daily 刷新策略配置失败（可忽略）: ${policyError.message}`,
            );
        }

        // 创建索引
        await sql`
            CREATE INDEX IF NOT EXISTS idx_run_stats_daily_lookup ON run_stats_daily (stat_period DESC, model_name, system)
        `.execute(kysely);
        console.log("   ✓ run_stats_daily 索引创建成功");
    } catch (error: any) {
        console.log(`   ❌ run_stats_daily 创建失败: ${error.message}`);
    }
    console.log("");

    // 创建周级聚合视图
    console.log("2. 创建 run_stats_weekly...");
    try {
        await sql`
            CREATE MATERIALIZED VIEW IF NOT EXISTS run_stats_weekly
            WITH (timescaledb.continuous)
            AS
            SELECT
                time_bucket('1 week', start_time) AS stat_period,
                model_name,
                system,
                COUNT(*) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS total_runs,
                SUM(CASE WHEN (run_type = 'llm' OR run_type IS NULL) AND error IS NULL THEN 1 ELSE 0 END) AS successful_runs,
                SUM(CASE WHEN (run_type = 'llm' OR run_type IS NULL) AND error IS NOT NULL THEN 1 ELSE 0 END) AS failed_runs,
                (SUM(CASE WHEN (run_type = 'llm' OR run_type IS NULL) AND error IS NOT NULL THEN 1 ELSE 0 END)::FLOAT /
                 NULLIF(SUM(CASE WHEN run_type = 'llm' OR run_type IS NULL THEN 1 ELSE 0 END), 0)) AS error_rate,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS total_duration_ms,
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS avg_duration_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS p95_duration_ms,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS p99_duration_ms,
                SUM(total_tokens) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS total_tokens_sum,
                AVG(total_tokens) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS avg_tokens_per_run,
                AVG(time_to_first_token) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS avg_ttft_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY time_to_first_token)
                    FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS p95_ttft_ms,
                COUNT(DISTINCT user_id) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS distinct_users
            FROM runs
            GROUP BY time_bucket('1 week', start_time), model_name, system
        `.execute(kysely);
        console.log("   ✓ run_stats_weekly 创建成功");

        // 配置刷新策略
        try {
            await sql`
                SELECT add_continuous_aggregate_policy('run_stats_weekly',
                    start_offset => INTERVAL '1 week',
                    end_offset => INTERVAL '5 minutes',
                    schedule_interval => INTERVAL '1 hour',
                    if_not_exists => TRUE
                )
            `.execute(kysely);
            console.log("   ✓ run_stats_weekly 刷新策略配置成功");
        } catch (policyError: any) {
            console.log(
                `   ⚠️  run_stats_weekly 刷新策略配置失败（可忽略）: ${policyError.message}`,
            );
        }

        // 创建索引
        await sql`
            CREATE INDEX IF NOT EXISTS idx_run_stats_weekly_lookup ON run_stats_weekly (stat_period DESC, model_name, system)
        `.execute(kysely);
        console.log("   ✓ run_stats_weekly 索引创建成功");
    } catch (error: any) {
        console.log(`   ❌ run_stats_weekly 创建失败: ${error.message}`);
    }
    console.log("");

    // 创建月级聚合视图
    console.log("3. 创建 run_stats_monthly...");
    try {
        await sql`
            CREATE MATERIALIZED VIEW IF NOT EXISTS run_stats_monthly
            WITH (timescaledb.continuous)
            AS
            SELECT
                time_bucket('1 month', start_time) AS stat_period,
                model_name,
                system,
                COUNT(*) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS total_runs,
                SUM(CASE WHEN (run_type = 'llm' OR run_type IS NULL) AND error IS NULL THEN 1 ELSE 0 END) AS successful_runs,
                SUM(CASE WHEN (run_type = 'llm' OR run_type IS NULL) AND error IS NOT NULL THEN 1 ELSE 0 END) AS failed_runs,
                (SUM(CASE WHEN (run_type = 'llm' OR run_type IS NULL) AND error IS NOT NULL THEN 1 ELSE 0 END)::FLOAT /
                 NULLIF(SUM(CASE WHEN run_type = 'llm' OR run_type IS NULL THEN 1 ELSE 0 END), 0)) AS error_rate,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS total_duration_ms,
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS avg_duration_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS p95_duration_ms,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS p99_duration_ms,
                SUM(total_tokens) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS total_tokens_sum,
                AVG(total_tokens) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS avg_tokens_per_run,
                AVG(time_to_first_token) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS avg_ttft_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY time_to_first_token)
                    FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS p95_ttft_ms,
                COUNT(DISTINCT user_id) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS distinct_users
            FROM runs
            GROUP BY time_bucket('1 month', start_time), model_name, system
        `.execute(kysely);
        console.log("   ✓ run_stats_monthly 创建成功");

        // 配置刷新策略
        try {
            await sql`
                SELECT add_continuous_aggregate_policy('run_stats_monthly',
                    start_offset => INTERVAL '1 month',
                    end_offset => INTERVAL '5 minutes',
                    schedule_interval => INTERVAL '1 day',
                    if_not_exists => TRUE
                )
            `.execute(kysely);
            console.log("   ✓ run_stats_monthly 刷新策略配置成功");
        } catch (policyError: any) {
            console.log(
                `   ⚠️  run_stats_monthly 刷新策略配置失败（可忽略）: ${policyError.message}`,
            );
        }

        // 创建索引
        await sql`
            CREATE INDEX IF NOT EXISTS idx_run_stats_monthly_lookup ON run_stats_monthly (stat_period DESC, model_name, system)
        `.execute(kysely);
        console.log("   ✓ run_stats_monthly 索引创建成功");
    } catch (error: any) {
        console.log(`   ❌ run_stats_monthly 创建失败: ${error.message}`);
    }
    console.log("");

    // 刷新所有视图
    console.log("4. 刷新所有视图...");
    const views = ["run_stats_daily", "run_stats_weekly", "run_stats_monthly"];
    for (const viewName of views) {
        try {
            await sql`CALL refresh_continuous_aggregate(${sql.raw(
                `'${viewName}'`,
            )}, NULL, NULL)`.execute(kysely);
            console.log(`   ✓ ${viewName} 刷新成功`);
        } catch (error: any) {
            console.log(`   ❌ ${viewName} 刷新失败: ${error.message}`);
        }
    }
    console.log("");

    console.log("=== 创建完成 ===\n");
    console.log(
        "注意：刷新策略配置失败通常是因为数据量不足，不影响基本功能使用。",
    );
    console.log("随着数据量的增加，可以手动重新配置刷新策略。\n");
}

// 运行脚本
createMissingViews().catch(console.error);
