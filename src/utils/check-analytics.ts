/**
 * 诊断和修复 Analytics API 问题的工具脚本
 */

import { createKyselyInstance } from "../database/kysely-dialects.js";
import { sql } from "kysely";

export async function checkAnalyticsStatus() {
    const kysely = await createKyselyInstance({
        connectionString: process.env.TRACE_DATABASE_URL!,
    });

    console.log("=== Analytics API 诊断工具 ===\n");

    // 1. 检查 runs 表数据
    console.log("1. 检查 runs 表数据...");
    const runsResult = await sql<{ count: number; first_run: Date; last_run: Date }>`
        SELECT COUNT(*) as count, MIN(start_time) as first_run, MAX(start_time) as last_run FROM runs
    `.execute(kysely);
    console.log(`   Runs 总数: ${runsResult.rows[0]?.count || 0}`);
    console.log(`   首条记录: ${runsResult.rows[0]?.first_run || "无"}`);
    console.log(`   最新记录: ${runsResult.rows[0]?.last_run || "无"}\n`);

    // 2. 检查连续聚合视图结构
    console.log("2. 检查 continuous_aggregates 视图结构...");
    try {
        // 先查询视图的列
        const columnsResult = await sql<{ column_name: string; data_type: string }>`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'continuous_aggregates'
            AND table_schema = 'timescaledb_information'
        `.execute(kysely);
        console.log("   continuous_aggregates 视图列:");
        columnsResult.rows.forEach((row) => {
            console.log(`   - ${row.column_name}: ${row.data_type}`);
        });
    } catch (error: any) {
        console.log(`   ⚠️  无法查询视图结构: ${error.message}`);
    }
    console.log("");

    // 3. 检查连续聚合视图数据
    console.log("3. 检查 continuous_aggregates 数据...");
    try {
        const viewsResult = await sql`
            SELECT * FROM timescaledb_information.continuous_aggregates LIMIT 5
        `.execute(kysely);
        console.log("   已创建的视图:");
        if (viewsResult.rows.length > 0) {
            viewsResult.rows.forEach((row: any) => {
                console.log(`   视图数据:`, JSON.stringify(row, null, 2));
            });
        } else {
            console.log("   ❌ 未找到任何连续聚合视图");
        }
    } catch (error: any) {
        console.log(`   ❌ 错误: ${error.message}`);
    }
    console.log("");

    // 4. 检查各聚合表数据
    const views = [
        "run_stats_hourly",
        "run_stats_15min",
        "run_stats_daily",
        "run_stats_weekly",
        "run_stats_monthly",
    ];
    for (const viewName of views) {
        console.log(
            `4.${views.indexOf(viewName) + 1} 检查 ${viewName} 数据...`,
        );

        const timeColumn =
            viewName === "run_stats_hourly" ? "stat_hour" : "stat_period";

        try {
            // 检查视图是否存在
            const existsResult = await sql<{ exists: boolean }>`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.views
                    WHERE table_name = ${sql.raw(`'${viewName}'`)}
                )
            `.execute(kysely);

            if (!existsResult.rows[0]?.exists) {
                console.log(`   ❌ 视图不存在`);
                continue;
            }

            // 检查数据量
            const countResult = await sql<{ count: number }>`
                SELECT COUNT(*) as count FROM ${sql.raw(viewName)}
            `.execute(kysely);
            const count = countResult.rows[0]?.count || 0;
            console.log(`   数据行数: ${count}`);

            if (count > 0) {
                // 检查时间范围
                const rangeResult = await sql<{ first_stat: Date; last_stat: Date }>`
                    SELECT MIN(${sql.raw(timeColumn)}) as first_stat, MAX(${sql.raw(timeColumn)}) as last_stat
                    FROM ${sql.raw(viewName)}
                `.execute(kysely);
                console.log(
                    `   时间范围: ${rangeResult.rows[0]?.first_stat} ~ ${rangeResult.rows[0]?.last_stat}`,
                );

                // 检查示例数据
                const sampleResult = await sql`
                    SELECT * FROM ${sql.raw(viewName)}
                    ORDER BY ${sql.raw(timeColumn)} DESC
                    LIMIT 3
                `.execute(kysely);
                console.log(`   最新数据示例:`);
                sampleResult.rows.slice(0, 2).forEach((row: any) => {
                    const time = row[timeColumn];
                    const model = row.model_name || "NULL";
                    const system = row.system || "NULL";
                    const totalRuns = row.total_runs || 0;
                    console.log(
                        `     - ${time}: model=${model}, system=${system}, total_runs=${totalRuns}`,
                    );
                });
            } else {
                console.log(`   ⚠️  视图为空，需要初始化数据`);
            }
        } catch (error: any) {
            console.log(`   ❌ 错误: ${error.message}`);
        }
        console.log("");
    }

    // 5. 检查聚合策略
    console.log("5. 检查聚合策略...");
    try {
        const policiesResult = await sql`
            SELECT * FROM timescaledb_information.jobs
            WHERE hypertable_name IS NOT NULL
            ORDER BY hypertable_name
        `.execute(kysely);
        console.log("   已配置的策略:");
        if (policiesResult.rows.length > 0) {
            policiesResult.rows.forEach((row: any) => {
                console.log(`   策略数据:`, JSON.stringify(row, null, 2));
            });
        } else {
            console.log("   ⚠️  未找到任何聚合策略");
        }
    } catch (error: any) {
        console.log(`   ❌ 错误: ${error.message}`);
    }
    console.log("");

    // 6. 尝试手动刷新聚合
    console.log("6. 尝试手动刷新聚合...");
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

    // 7. 检查刷新后的数据
    console.log("7. 刷新后检查数据...");
    try {
        const hourlyCount = await sql<{ count: number }>`
            SELECT COUNT(*) as count FROM run_stats_hourly
        `.execute(kysely);
        console.log(
            `   run_stats_hourly 数据行数: ${hourlyCount.rows[0]?.count || 0}`,
        );
    } catch (error: any) {
        console.log(`   ❌ 错误: ${error.message}`);
    }
    console.log("");

    // 8. 测试一个实际的查询
    console.log("8. 测试实际的 timeseries 查询...");
    try {
        const testQuery = `
            SELECT
                stat_hour as time,
                SUM(total_tokens_sum) as total_tokens_sum
            FROM run_stats_hourly
            WHERE stat_hour >= NOW() - INTERVAL '7 days'
            GROUP BY stat_hour
            ORDER BY stat_hour DESC
            LIMIT 10
        `;
        const result = await sql.raw(testQuery).execute(kysely);
        console.log(`   查询成功，返回 ${result.rows.length} 行数据`);
        result.rows.slice(0, 3).forEach((row: any) => {
            console.log(
                `   - ${row.time}: total_tokens_sum=${row.total_tokens_sum}`,
            );
        });
    } catch (error: any) {
        console.log(`   ❌ 查询失败: ${error.message}`);
    }
    console.log("");

    console.log("=== 诊断完成 ===\n");
}

// 运行诊断
checkAnalyticsStatus().catch(console.error);
