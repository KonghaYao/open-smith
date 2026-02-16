#!/usr/bin/env bun
/**
 * 数据库修复脚本
 * 用于补全 Open Smith 数据库的缺失表和结构，同时保留现有数据
 */

import { createKyselyInstance } from '../src/database/kysely-dialects.js';
import { sql } from 'kysely';

async function main() {
    console.log('🔧 Fixing Open Smith database...\n');

    let kysely;
    try {
        kysely = await createKyselyInstance({
            connectionString: process.env.TRACE_DATABASE_URL,
        });

        // 1. 创建缺失的表
        console.log('📋 Creating missing tables...\n');

        // 1.1 创建 feedback 表
        console.log('Creating feedback table...');
        await sql`
            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                trace_id TEXT NOT NULL,
                run_id TEXT NOT NULL,
                run_start_time TIMESTAMPTZ,
                feedback_id TEXT,
                score DECIMAL,
                comment TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `.execute(kysely);

        await sql`
            CREATE INDEX IF NOT EXISTS idx_feedback_run_id ON feedback (run_id)
        `.execute(kysely);

        await sql`
            CREATE INDEX IF NOT EXISTS idx_feedback_trace_id ON feedback (trace_id)
        `.execute(kysely);

        await sql`
            CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC)
        `.execute(kysely);

        console.log('  ✓ feedback table created\n');

        // 1.2 创建 attachments 表
        console.log('Creating attachments table...');
        await sql`
            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                run_start_time TIMESTAMPTZ,
                filename TEXT NOT NULL,
                content_type TEXT,
                file_size INTEGER,
                storage_path TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `.execute(kysely);

        await sql`
            CREATE INDEX IF NOT EXISTS idx_attachments_run_id ON attachments (run_id)
        `.execute(kysely);

        console.log('  ✓ attachments table created\n');

        // 1.3 创建 run_stats_raw 表
        console.log('Creating run_stats_raw table...');
        await sql`
            CREATE TABLE IF NOT EXISTS run_stats_raw (
                id TEXT NOT NULL,
                stat_hour TIMESTAMPTZ NOT NULL,
                model_name TEXT,
                system TEXT NOT NULL,
                run_id TEXT NOT NULL,
                duration_ms INTEGER,
                token_count INTEGER DEFAULT 0,
                ttft_ms INTEGER,
                is_success BOOLEAN NOT NULL DEFAULT TRUE,
                user_id TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (id, stat_hour)
            )
        `.execute(kysely);

        // 转换为 hypertable
        const hypertableCheck = await sql`
            SELECT EXISTS (
                SELECT FROM timescaledb_information.hypertables
                WHERE hypertable_name = 'run_stats_raw'
            )
        `.execute(kysely);

        if (!hypertableCheck.rows[0]?.exists) {
            await sql`
                SELECT create_hypertable('run_stats_raw', 'stat_hour', if_not_exists => TRUE)
            `.execute(kysely);
            console.log('  ✓ run_stats_raw created as hypertable');
        } else {
            console.log('  ✓ run_stats_raw already exists as hypertable');
        }

        await sql`
            CREATE INDEX IF NOT EXISTS idx_run_stats_raw_system ON run_stats_raw (system)
        `.execute(kysely);

        await sql`
            CREATE INDEX IF NOT EXISTS idx_run_stats_raw_model_name ON run_stats_raw (model_name)
        `.execute(kysely);

        await sql`
            CREATE INDEX IF NOT EXISTS idx_run_stats_raw_stat_hour ON run_stats_raw (stat_hour DESC)
        `.execute(kysely);

        console.log('  ✓ run_stats_raw indexes created\n');

        // 1.4 检查并修复 runs 表（应该已经是 hypertable）
        console.log('Checking runs table hypertable status...');
        const runsHypertableCheck = await sql`
            SELECT EXISTS (
                SELECT FROM timescaledb_information.hypertables
                WHERE hypertable_name = 'runs'
            )
        `.execute(kysely);

        if (!runsHypertableCheck.rows[0]?.exists) {
            console.log('  ⚠️  runs table is NOT a hypertable');
            console.log('  ⚠️  Converting runs to hypertable requires:');
            console.log('     1. Backing up existing data');
            console.log('     2. Dropping and recreating table');
            console.log('     3. Restoring data');
            console.log('  ⚠️  This is NOT recommended for production databases!');
            console.log('  ℹ️  Skipping automatic conversion. Please handle manually if needed.');
        } else {
            console.log('  ✓ runs table is a hypertable');
        }
        console.log();

        // 2. 创建连续聚合视图
        console.log('📈 Creating continuous aggregates...\n');

        // 2.1 小时级聚合
        console.log('Creating run_stats_hourly...');
        await createContinuousAggregate(kysely, 'run_stats_hourly', '1 hour');
        console.log('  ✓ run_stats_hourly created\n');

        // 2.2 15分钟级聚合
        console.log('Creating run_stats_15min...');
        await createContinuousAggregate(kysely, 'run_stats_15min', '15 minutes');
        console.log('  ✓ run_stats_15min created\n');

        // 2.3 天级聚合
        console.log('Creating run_stats_daily...');
        await createContinuousAggregate(kysely, 'run_stats_daily', '1 day');
        console.log('  ✓ run_stats_daily created\n');

        // 2.4 周级聚合
        console.log('Creating run_stats_weekly...');
        await createContinuousAggregate(kysely, 'run_stats_weekly', '1 week');
        console.log('  ✓ run_stats_weekly created\n');

        // 2.5 月级聚合
        console.log('Creating run_stats_monthly...');
        await createContinuousAggregate(kysely, 'run_stats_monthly', '1 month');
        console.log('  ✓ run_stats_monthly created\n');

        // 3. 创建触发器和函数
        console.log('🔧 Creating triggers and functions...\n');

        // 3.1 创建更新统计数据的触发器函数（支持 INSERT 和 UPDATE）
        console.log('Creating update_stats_raw() function...');
        await sql`
            CREATE OR REPLACE FUNCTION update_stats_raw()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'UPDATE' THEN
                    -- UPDATE 操作：先删除旧记录
                    DELETE FROM run_stats_raw WHERE run_id = NEW.id;
                END IF;

                -- 插入新记录（支持 INSERT 和 UPDATE）
                INSERT INTO run_stats_raw (
                    id,
                    stat_hour,
                    model_name,
                    system,
                    run_id,
                    duration_ms,
                    token_count,
                    ttft_ms,
                    is_success,
                    user_id
                ) VALUES (
                    gen_random_uuid()::text,
                    NEW.start_time,
                    NEW.model_name,
                    NEW.system,
                    NEW.id,
                    EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) * 1000,
                    COALESCE(NEW.total_tokens, 0),
                    NEW.time_to_first_token,
                    (NEW.error IS NULL),
                    NEW.user_id
                );

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `.execute(kysely);

        console.log('  ✓ update_stats_raw() function created');

        // 3.2 创建触发器（支持 INSERT 和 UPDATE）
        console.log('Creating trigger on runs...');
        await sql`
            DROP TRIGGER IF EXISTS trigger_update_stats_raw ON runs
        `.execute(kysely);

        await sql`
            CREATE TRIGGER trigger_update_stats_raw
            AFTER INSERT OR UPDATE ON runs
            FOR EACH ROW
            EXECUTE FUNCTION update_stats_raw()
        `.execute(kysely);

        console.log('  ✓ trigger_update_stats_raw created\n');

        console.log('✅ Database fix completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Restart your application');
        console.log('   2. Run "bun scripts/check-db.ts" to verify the fix');
        console.log('   3. The system will now populate run_stats_raw for new runs and updates');

    } catch (error) {
        console.error('❌ Error fixing database:', error);
        process.exit(1);
    } finally {
        if (kysely) {
            await kysely.destroy();
        }
    }
}

// 辅助函数：创建连续聚合视图
async function createContinuousAggregate(
    kysely: any,
    viewName: string,
    bucketInterval: string
) {
    const viewExists = await sql`
        SELECT EXISTS (
            SELECT FROM timescaledb_information.continuous_aggregates
            WHERE view_name = ${sql.raw(`'${viewName}'`)}
        )
    `.execute(kysely);

    if (viewExists.rows[0]?.exists) {
        console.log(`  ${viewName} already exists, skipping...`);
        return;
    }

    const createViewSQL = `
        CREATE MATERIALIZED VIEW ${viewName}
        WITH (timescaledb.continuous)
        AS
        SELECT
            time_bucket('${bucketInterval}', stat_hour) AS stat_period,
            model_name,
            system,
            COUNT(*) AS total_runs,
            SUM(CASE WHEN is_success THEN 1 ELSE 0 END) AS successful_runs,
            SUM(CASE WHEN NOT is_success THEN 1 ELSE 0 END) AS failed_runs,
            (SUM(CASE WHEN NOT is_success THEN 1 ELSE 0 END)::FLOAT / NULLIF(COUNT(*), 0)) AS error_rate,
            SUM(duration_ms) AS total_duration_ms,
            AVG(duration_ms) AS avg_duration_ms,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
            percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration_ms,
            SUM(token_count) AS total_tokens_sum,
            AVG(token_count) AS avg_tokens_per_run,
            AVG(ttft_ms) AS avg_ttft_ms,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY ttft_ms) AS p95_ttft_ms,
            COUNT(DISTINCT user_id) AS distinct_users
        FROM run_stats_raw
        GROUP BY time_bucket('${bucketInterval}', stat_hour), model_name, system
        ${bucketInterval === '1 hour' ? 'WITH NO DATA' : ''}
    `;

    await sql.raw(createViewSQL).execute(kysely);

    // 配置刷新策略 - 修复：确保刷新窗口至少包含2个bucket
    const policyConfig = {
        '1 hour': {
            startOffset: '3 hours',
            endOffset: '1 hour',  // 从1分钟改为1小时，确保至少有2个bucket
            scheduleInterval: '5 minutes',
        },
        '15 minutes': {
            startOffset: '2 hours',
            endOffset: '30 minutes',  // 从1分钟改为30分钟
            scheduleInterval: '2 minutes',
        },
        '1 day': {
            startOffset: '7 days',
            endOffset: '1 day',  // 从1小时改为1天
            scheduleInterval: '30 minutes',
        },
        '1 week': {
            startOffset: '4 weeks',
            endOffset: '1 week',  // 从1天改为1周
            scheduleInterval: '1 hour',
        },
        '1 month': {
            startOffset: '3 months',
            endOffset: '1 month',  // 从1天改为1个月
            scheduleInterval: '1 day',
        },
    };

    const config = policyConfig[bucketInterval as keyof typeof policyConfig] || policyConfig['1 hour'];

    const policySQL = `
        SELECT add_continuous_aggregate_policy(
            '${viewName}',
            start_offset => INTERVAL '${config.startOffset}',
            end_offset => INTERVAL '${config.endOffset}',
            schedule_interval => INTERVAL '${config.scheduleInterval}',
            if_not_exists => TRUE
        )
    `;

    await sql.raw(policySQL).execute(kysely);

    // 创建索引
    const indexSQL = `
        CREATE INDEX IF NOT EXISTS idx_${viewName}_lookup
        ON ${viewName} (stat_period DESC, model_name, system)
    `;

    await sql.raw(indexSQL).execute(kysely);
}

// 运行脚本
main().catch(console.error);
