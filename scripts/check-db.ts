#!/usr/bin/env bun
/**
 * 数据库检查和修复脚本
 * 用于检查并修复 Open Smith 数据库的表结构问题
 */

import { createKyselyInstance } from '../src/database/kysely-dialects.js';
import { sql } from 'kysely';

async function main() {
    console.log('🔍 Checking Open Smith database...\n');

    let kysely;
    try {
        kysely = await createKyselyInstance({
            connectionString: process.env.TRACE_DATABASE_URL,
        });

        // 检查必需的表
        const requiredTables = [
            'systems',
            'runs',
            'feedback',
            'attachments',
            'run_stats_raw',
            'run_stats_hourly',
        ];

        console.log('📋 Checking required tables...');
        const missingTables: string[] = [];

        for (const tableName of requiredTables) {
            const result = await sql`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = ${sql.raw(`'${tableName}'`)}
                )
            `.execute(kysely);

            const exists = result.rows[0]?.exists;
            if (exists) {
                console.log(`  ✓ ${tableName}`);
            } else {
                console.log(`  ✗ ${tableName} - MISSING`);
                missingTables.push(tableName);
            }
        }

        if (missingTables.length === 0) {
            console.log('\n✅ All required tables exist!');
        } else {
            console.log(`\n⚠️  Missing tables: ${missingTables.join(', ')}`);
            console.log('\n💡 To fix this, you can:');
            console.log('   1. Stop the application');
            console.log('   2. Manually execute the SQL script:');
            console.log(`      psql ${process.env.TRACE_DATABASE_URL} -f sql/init-timescaledb.sql`);
            console.log('   3. Restart the application');
            console.log('\n   Or delete all tables and let the app recreate them:');
            console.log('      psql -d your_database -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"');
        }

        // 检查 TimescaleDB 扩展
        console.log('\n🔧 Checking TimescaleDB extension...');
        const extensionResult = await sql`
            SELECT EXISTS (
                SELECT FROM pg_extension
                WHERE extname = 'timescaledb'
            )
        `.execute(kysely);

        const extensionExists = extensionResult.rows[0]?.exists;
        if (extensionExists) {
            console.log('  ✓ TimescaleDB extension is installed');
        } else {
            console.log('  ✗ TimescaleDB extension is NOT installed');
            console.log('    Run: CREATE EXTENSION IF NOT EXISTS timescaledb;');
        }

        // 检查 hypertable
        console.log('\n📊 Checking hypertables...');
        const hypertables = ['runs', 'run_stats_raw'];

        for (const hypertableName of hypertables) {
            const result = await sql`
                SELECT EXISTS (
                    SELECT FROM timescaledb_information.hypertables
                    WHERE hypertable_name = ${sql.raw(`'${hypertableName}'`)}
                )
            `.execute(kysely);

            const isHypertable = result.rows[0]?.exists;
            if (isHypertable) {
                console.log(`  ✓ ${hypertableName} is a hypertable`);
            } else {
                console.log(`  ✗ ${hypertableName} is NOT a hypertable`);
            }
        }

        // 检查连续聚合视图
        console.log('\n📈 Checking continuous aggregates...');
        const continuousAggregates = [
            'run_stats_hourly',
            'run_stats_15min',
            'run_stats_daily',
            'run_stats_weekly',
            'run_stats_monthly',
        ];

        for (const viewName of continuousAggregates) {
            const result = await sql`
                SELECT EXISTS (
                    SELECT FROM timescaledb_information.continuous_aggregates
                    WHERE view_name = ${sql.raw(`'${viewName}'`)}
                )
            `.execute(kysely);

            const exists = result.rows[0]?.exists;
            if (exists) {
                console.log(`  ✓ ${viewName}`);
            } else {
                console.log(`  ✗ ${viewName} - MISSING`);
            }
        }

        // 显示表统计（使用 PostgreSQL pg_stat_user_tables 视图）
        console.log('\n📊 Table statistics...');
        try {
            const tablesResult = await sql`
                SELECT
                    schemaname,
                    relname as table_name,
                    n_tup_ins as inserts,
                    n_tup_upd as updates,
                    n_tup_del as deletes,
                    n_live_tup as live_rows,
                    n_dead_tup as dead_rows
                FROM pg_stat_user_tables
                WHERE schemaname = 'public'
                ORDER BY relname
            `.execute(kysely);

            if (tablesResult.rows.length === 0) {
                console.log('  No tables found in public schema');
            } else {
                console.log('  Schema     | Table Name     | Inserts | Updates | Deletes | Live Rows | Dead Rows');
                console.log('  -----------+----------------+---------+---------+---------+-----------+----------');
                for (const row of tablesResult.rows) {
                    console.log(
                        `  ${row.schemaname?.padEnd(10)} | ${row.table_name?.padEnd(14)} | ` +
                        `${String(row.inserts || 0).padStart(7)} | ${String(row.updates || 0).padStart(7)} | ` +
                        `${String(row.deletes || 0).padStart(7)} | ${String(row.live_rows || 0).padStart(9)} | ` +
                        `${String(row.dead_rows || 0).padStart(9)}`
                    );
                }
            }
        } catch (error) {
            console.log('  Unable to retrieve table statistics (may require elevated permissions)');
        }

    } catch (error) {
        console.error('❌ Error checking database:', error);
        process.exit(1);
    } finally {
        if (kysely) {
            await kysely.destroy();
        }
    }

    console.log('\n✅ Database check completed!');
}

// 运行脚本
main().catch(console.error);
