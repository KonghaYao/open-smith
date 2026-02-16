#!/usr/bin/env bun
/**
 * 诊断并修复 run_stats_raw 表的 token_count 同步问题
 */

import { createKyselyInstance } from '../src/database/kysely-dialects.js';
import { sql } from 'kysely';

async function main() {
    console.log('🔍 Diagnosing run_stats_raw token_count sync...\n');

    let kysely;
    try {
        kysely = await createKyselyInstance({
            connectionString: process.env.TRACE_DATABASE_URL,
        });

        // 1. 检查 run_stats_raw 表中是否有数据
        console.log('1️⃣ Checking run_stats_raw table...');
        const rawCount = await sql`
            SELECT COUNT(*) as count
            FROM run_stats_raw
        `.execute(kysely);

        console.log(`   run_stats_raw has ${rawCount.rows[0]?.count || 0} records`);

        // 2. 检查 runs 表中是否有数据
        console.log('\n2️⃣ Checking runs table...');
        const runsCount = await sql`
            SELECT COUNT(*) as count
            FROM runs
        `.execute(kysely);

        console.log(`   runs has ${runsCount.rows[0]?.count || 0} records`);

        // 3. 检查触发器是否存在
        console.log('\n3️⃣ Checking triggers on runs table...');
        const triggerCheck = await sql`
            SELECT tgname, tgenabled
            FROM pg_trigger
            WHERE tgrelid = 'runs'::regclass
            AND tgname = 'trigger_update_stats_raw'
        `.execute(kysely);

        if (triggerCheck.rows.length > 0) {
            console.log(`   ✓ Trigger 'trigger_update_stats_raw' exists`);
            console.log(`   Status: ${triggerCheck.rows[0].tgenabled === 'O' ? 'ENABLED' : 'DISABLED'}`);
        } else {
            console.log('   ✗ Trigger does not exist!');
        }

        // 4. 检查触发器函数
        console.log('\n4️⃣ Checking trigger function...');
        const functionCheck = await sql`
            SELECT pg_get_functiondef(oid) as definition
            FROM pg_proc
            WHERE proname = 'update_stats_raw'
        `.execute(kysely);

        if (functionCheck.rows.length > 0) {
            console.log('   ✓ Function update_stats_raw() exists');
            const def = functionCheck.rows[0].definition;
            const supportsUpdate = def.includes('INSERT OR UPDATE');
            console.log(`   Supports: ${supportsUpdate ? 'INSERT OR UPDATE ✓' : 'INSERT ONLY ✗'}`);
        } else {
            console.log('   ✗ Function does not exist!');
        }

        // 5. 抽样检查 token_count 差异
        console.log('\n5️⃣ Checking token_count consistency...');
        const diffCheck = await sql`
            SELECT
                r.id,
                r.total_tokens as runs_total_tokens,
                rsr.token_count as raw_token_count
            FROM runs r
            LEFT JOIN run_stats_raw rsr ON rsr.run_id = r.id
            WHERE COALESCE(r.total_tokens, 0) != COALESCE(rsr.token_count, 0)
            LIMIT 5
        `.execute(kysely);

        if (diffCheck.rows.length > 0) {
            console.log(`   ⚠️  Found ${diffCheck.rows.length} records with inconsistent token_count:`);
            diffCheck.rows.forEach((row: any) => {
                console.log(`      - run ${row.id}: runs.total_tokens=${row.runs_total_tokens}, raw.token_count=${row.raw_token_count}`);
            });
        } else {
            console.log('   ✓ All token_count values are consistent');
        }

        // 6. 询问是否需要修复
        console.log('\n🔧 Fix Options:');
        console.log('   1. Re-create/update trigger (supports INSERT OR UPDATE)');
        console.log('   2. Sync existing run_stats_raw data from runs table');
        console.log('   3. Do both (recommended)');
        console.log('   4. Exit without changes\n');

        const args = process.argv.slice(2);
        const choice = args[0] || '3';

        if (choice === '1' || choice === '3') {
            console.log('\n📝 Updating trigger...');

            // 删除旧触发器
            await sql`DROP TRIGGER IF EXISTS trigger_update_stats_raw ON runs`.execute(kysely);
            console.log('   ✓ Dropped old trigger');

            // 更新触发器函数
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
            console.log('   ✓ Updated trigger function');

            // 创建新触发器
            await sql`
                CREATE TRIGGER trigger_update_stats_raw
                AFTER INSERT OR UPDATE ON runs
                FOR EACH ROW
                EXECUTE FUNCTION update_stats_raw()
            `.execute(kysely);
            console.log('   ✓ Created new trigger (INSERT OR UPDATE)');
        }

        if (choice === '2' || choice === '3') {
            console.log('\n🔄 Syncing run_stats_raw data...');

            // 删除所有现有的 run_stats_raw 记录
            const deleteResult = await sql`DELETE FROM run_stats_raw`.execute(kysely);
            console.log(`   ✓ Deleted ${deleteResult.rowCount} old records from run_stats_raw`);

            // 从 runs 表重新插入数据
            const insertResult = await sql`
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
                )
                SELECT
                    gen_random_uuid()::text,
                    r.start_time,
                    r.model_name,
                    r.system,
                    r.id,
                    EXTRACT(EPOCH FROM (r.end_time - r.start_time)) * 1000,
                    COALESCE(r.total_tokens, 0),
                    r.time_to_first_token,
                    (r.error IS NULL),
                    r.user_id
                FROM runs r
            `.execute(kysely);
            console.log(`   ✓ Inserted ${insertResult.rowCount} records from runs`);
        }

        // 7. 刷新连续聚合
        console.log('\n📊 Refreshing continuous aggregates...');
        try {
            await sql`CALL refresh_continuous_aggregate('run_stats_hourly', NULL, NULL)`.execute(kysely);
            console.log('   ✓ Refreshed run_stats_hourly');
        } catch (error: any) {
            console.log(`   ⚠️  Failed to refresh: ${error.message}`);
        }

        // 8. 验证修复
        console.log('\n✅ Verifying fix...');
        const finalCheck = await sql`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN token_count > 0 THEN 1 ELSE 0 END) as with_tokens
            FROM run_stats_raw
        `.execute(kysely);

        const total = Number(finalCheck.rows[0]?.total || 0);
        const withTokens = Number(finalCheck.rows[0]?.with_tokens || 0);

        console.log(`   run_stats_raw: ${total} total records, ${withTokens} with tokens`);
        if (withTokens > 0) {
            console.log(`   ✨ Fix completed successfully! ${(withTokens / total * 100).toFixed(1)}% of records have token data`);
        } else {
            console.log('   ⚠️  No token data found - runs.total_tokens may be empty');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        if (kysely) {
            await kysely.destroy();
        }
    }
}

main().catch(console.error);
