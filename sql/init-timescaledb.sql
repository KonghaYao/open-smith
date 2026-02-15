-- Open Smith TimescaleDB 数据库初始化脚本
-- 版本: 2.3
-- 创建日期: 2026-02-15
-- 更新日期: 2026-02-15 - 修复统计问题：只统计 run_type = 'llm' 的记录

-- =====================================================
-- 1. 创建扩展
-- =====================================================

-- 启用 TimescaleDB 扩展
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =====================================================
-- 2. 创建核心表
-- =====================================================

-- 2.1 创建 systems 表
CREATE TABLE IF NOT EXISTS systems (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    api_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建 systems 表索引
CREATE INDEX IF NOT EXISTS idx_systems_name ON systems (name);
CREATE INDEX IF NOT EXISTS idx_systems_api_key ON systems (api_key);
CREATE INDEX IF NOT EXISTS idx_systems_status ON systems (status);

-- 2.2 创建 runs 表 (Hypertable)
CREATE TABLE IF NOT EXISTS runs (
    id TEXT NOT NULL,
    trace_id TEXT,
    name TEXT,
    run_type TEXT,
    system TEXT NOT NULL,
    thread_id TEXT,
    user_id TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    inputs JSONB,
    outputs JSONB,
    events JSONB,
    error JSONB,
    extra JSONB,
    serialized JSONB,
    total_tokens INTEGER DEFAULT 0,
    model_name TEXT,
    time_to_first_token INTEGER DEFAULT 0,
    tags JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, start_time),
    CONSTRAINT fk_runs_system FOREIGN KEY (system) REFERENCES systems (name) ON DELETE CASCADE
);

-- 创建超表，按 start_time 分区
-- 注意：create_hypertable 使用 if_not_exists 参数时需要特殊处理
DO $$
BEGIN
    -- 检查 runs 表是否已经是 hypertable
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'runs'
    ) THEN
        PERFORM create_hypertable('runs', 'start_time', if_not_exists => TRUE);
        RAISE NOTICE 'Created hypertable for runs';
    ELSE
        RAISE NOTICE 'Runs table is already a hypertable';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating hypertable for runs (may already exist): %', SQLERRM;
END $$;

-- 创建 runs 表索引
CREATE INDEX IF NOT EXISTS idx_runs_system ON runs (system);
CREATE INDEX IF NOT EXISTS idx_runs_model_name ON runs (model_name);
CREATE INDEX IF NOT EXISTS idx_runs_thread_id ON runs (thread_id);
CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs (user_id);
CREATE INDEX IF NOT EXISTS idx_runs_trace_id ON runs (trace_id);
CREATE INDEX IF NOT EXISTS idx_runs_run_type ON runs (run_type);
CREATE INDEX IF NOT EXISTS idx_runs_start_time ON runs (start_time DESC);

-- 2.3 创建 feedback 表
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
    -- 注意：由于 TimescaleDB hypertable 的主键包含分区列，
    -- 外键约束需要引用完整的复合主键 (id, start_time)
    -- 这会使得表结构复杂化，因此这里暂时不添加外键约束
    -- 应用层需要确保数据一致性
);

-- 创建 feedback 表索引
CREATE INDEX IF NOT EXISTS idx_feedback_run_id ON feedback (run_id);
CREATE INDEX IF NOT EXISTS idx_feedback_trace_id ON feedback (trace_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);

-- 2.4 创建 attachments 表
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    run_start_time TIMESTAMPTZ,
    filename TEXT NOT NULL,
    content_type TEXT,
    file_size INTEGER,
    storage_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- 注意：由于 TimescaleDB hypertable 的主键包含分区列，
    -- 外键约束需要引用完整的复合主键 (id, start_time)
    -- 这会使得表结构复杂化，因此这里暂时不添加外键约束
    -- 应用层需要确保数据一致性
);

-- 创建 attachments 表索引
CREATE INDEX IF NOT EXISTS idx_attachments_run_id ON attachments (run_id);

-- =====================================================
-- 3. 创建连续聚合视图（直接在 runs 表上）
-- =====================================================

-- 3.1 小时级聚合视图
DO $$
BEGIN
    -- 检查视图是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = 'run_stats_hourly'
    ) THEN
        EXECUTE format('
            CREATE MATERIALIZED VIEW run_stats_hourly
            WITH (timescaledb.continuous)
            AS
            SELECT
                time_bucket(''1 hour'', start_time) AS stat_hour,
                model_name,
                system,
                COUNT(*) FILTER (WHERE run_type = ''llm'') AS total_runs,
                SUM(CASE WHEN run_type = ''llm'' AND error IS NULL THEN 1 ELSE 0 END) AS successful_runs,
                SUM(CASE WHEN run_type = ''llm'' AND error IS NOT NULL THEN 1 ELSE 0 END) AS failed_runs,
                (SUM(CASE WHEN run_type = ''llm'' AND error IS NOT NULL THEN 1 ELSE 0 END)::FLOAT /
                 NULLIF(SUM(CASE WHEN run_type = ''llm'' THEN 1 ELSE 0 END), 0)) AS error_rate,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = ''llm'') AS total_duration_ms,
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = ''llm'') AS avg_duration_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = ''llm'') AS p95_duration_ms,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = ''llm'') AS p99_duration_ms,
                SUM(total_tokens) FILTER (WHERE run_type = ''llm'') AS total_tokens_sum,
                AVG(total_tokens) FILTER (WHERE run_type = ''llm'') AS avg_tokens_per_run,
                AVG(time_to_first_token) FILTER (WHERE run_type = ''llm'') AS avg_ttft_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY time_to_first_token)
                    FILTER (WHERE run_type = ''llm'') AS p95_ttft_ms,
                COUNT(DISTINCT user_id) FILTER (WHERE run_type = ''llm'') AS distinct_users
            FROM runs
            GROUP BY time_bucket(''1 hour'', start_time), model_name, system
            WITH NO DATA
        ');

        -- 配置小时级聚合刷新策略
        PERFORM add_continuous_aggregate_policy('run_stats_hourly',
            start_offset => INTERVAL '3 hours',
            end_offset => INTERVAL '1 minute',
            schedule_interval => INTERVAL '5 minutes',
            if_not_exists => TRUE
        );

        -- 创建索引
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_run_stats_hourly_lookup
            ON run_stats_hourly (stat_hour DESC, model_name, system)';

        RAISE NOTICE 'Created continuous aggregate view: run_stats_hourly';
    ELSE
        RAISE NOTICE 'Continuous aggregate view run_stats_hourly already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating continuous aggregate run_stats_hourly: %', SQLERRM;
END $$;

-- 3.2 15分钟级聚合视图
DO $$
BEGIN
    -- 检查视图是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = 'run_stats_15min'
    ) THEN
        EXECUTE format('
            CREATE MATERIALIZED VIEW run_stats_15min
            WITH (timescaledb.continuous)
            AS
            SELECT
                time_bucket(''15 minutes'', start_time) AS stat_period,
                model_name,
                system,
                COUNT(*) FILTER (WHERE run_type = ''llm'') AS total_runs,
                SUM(CASE WHEN run_type = ''llm'' AND error IS NULL THEN 1 ELSE 0 END) AS successful_runs,
                SUM(CASE WHEN run_type = ''llm'' AND error IS NOT NULL THEN 1 ELSE 0 END) AS failed_runs,
                (SUM(CASE WHEN run_type = ''llm'' AND error IS NOT NULL THEN 1 ELSE 0 END)::FLOAT /
                 NULLIF(SUM(CASE WHEN run_type = ''llm'' THEN 1 ELSE 0 END), 0)) AS error_rate,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = ''llm'') AS total_duration_ms,
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = ''llm'') AS avg_duration_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = ''llm'') AS p95_duration_ms,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = ''llm'') AS p99_duration_ms,
                SUM(total_tokens) FILTER (WHERE run_type = ''llm'') AS total_tokens_sum,
                AVG(total_tokens) FILTER (WHERE run_type = ''llm'') AS avg_tokens_per_run,
                AVG(time_to_first_token) FILTER (WHERE run_type = ''llm'') AS avg_ttft_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY time_to_first_token)
                    FILTER (WHERE run_type = ''llm'') AS p95_ttft_ms,
                COUNT(DISTINCT user_id) FILTER (WHERE run_type = ''llm'') AS distinct_users
            FROM runs
            GROUP BY time_bucket(''15 minutes'', start_time), model_name, system
            WITH NO DATA
        ');

        -- 配置 15分钟级聚合刷新策略
        PERFORM add_continuous_aggregate_policy('run_stats_15min',
            start_offset => INTERVAL '1 hour',
            end_offset => INTERVAL '1 minute',
            schedule_interval => INTERVAL '2 minutes',
            if_not_exists => TRUE
        );

        -- 创建索引
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_run_stats_15min_lookup
            ON run_stats_15min (stat_period DESC, model_name, system)';

        RAISE NOTICE 'Created continuous aggregate view: run_stats_15min';
    ELSE
        RAISE NOTICE 'Continuous aggregate view run_stats_15min already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating continuous aggregate run_stats_15min: %', SQLERRM;
END $$;

-- 3.3 天级聚合视图
DO $$
BEGIN
    -- 检查视图是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = 'run_stats_daily'
    ) THEN
        EXECUTE format('
            CREATE MATERIALIZED VIEW run_stats_daily
            WITH (timescaledb.continuous)
            AS
            SELECT
                time_bucket(''1 day'', start_time) AS stat_period,
                model_name,
                system,
                COUNT(*) FILTER (WHERE run_type = ''llm'') AS total_runs,
                SUM(CASE WHEN run_type = ''llm'' AND error IS NULL THEN 1 ELSE 0 END) AS successful_runs,
                SUM(CASE WHEN run_type = ''llm'' AND error IS NOT NULL THEN 1 ELSE 0 END) AS failed_runs,
                (SUM(CASE WHEN run_type = ''llm'' AND error IS NOT NULL THEN 1 ELSE 0 END)::FLOAT /
                 NULLIF(SUM(CASE WHEN run_type = ''llm'' THEN 1 ELSE 0 END), 0)) AS error_rate,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = ''llm'') AS total_duration_ms,
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = ''llm'') AS avg_duration_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = ''llm'') AS p95_duration_ms,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = ''llm'') AS p99_duration_ms,
                SUM(total_tokens) FILTER (WHERE run_type = ''llm'') AS total_tokens_sum,
                AVG(total_tokens) FILTER (WHERE run_type = ''llm'') AS avg_tokens_per_run,
                AVG(time_to_first_token) FILTER (WHERE run_type = ''llm'') AS avg_ttft_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY time_to_first_token)
                    FILTER (WHERE run_type = ''llm'') AS p95_ttft_ms,
                COUNT(DISTINCT user_id) FILTER (WHERE run_type = ''llm'') AS distinct_users
            FROM runs
            GROUP BY time_bucket(''1 day'', start_time), model_name, system
        ');

        -- 配置天级聚合刷新策略
        PERFORM add_continuous_aggregate_policy('run_stats_daily',
            start_offset => INTERVAL '1 day',
            end_offset => INTERVAL '1 hour',
            schedule_interval => INTERVAL '30 minutes',
            if_not_exists => TRUE
        );

        -- 创建索引
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_run_stats_daily_lookup
            ON run_stats_daily (stat_period DESC, model_name, system)';

        RAISE NOTICE 'Created continuous aggregate view: run_stats_daily';
    ELSE
        RAISE NOTICE 'Continuous aggregate view run_stats_daily already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating continuous aggregate run_stats_daily: %', SQLERRM;
END $$;

-- 3.4 周级聚合视图
DO $$
BEGIN
    -- 检查视图是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = 'run_stats_weekly'
    ) THEN
        EXECUTE format('
            CREATE MATERIALIZED VIEW run_stats_weekly
            WITH (timescaledb.continuous)
            AS
            SELECT
                time_bucket(''1 week'', start_time) AS stat_period,
                model_name,
                system,
                COUNT(*) FILTER (WHERE run_type = ''llm'') AS total_runs,
                SUM(CASE WHEN run_type = ''llm'' AND error IS NULL THEN 1 ELSE 0 END) AS successful_runs,
                SUM(CASE WHEN run_type = ''llm'' AND error IS NOT NULL THEN 1 ELSE 0 END) AS failed_runs,
                (SUM(CASE WHEN run_type = ''llm'' AND error IS NOT NULL THEN 1 ELSE 0 END)::FLOAT /
                 NULLIF(SUM(CASE WHEN run_type = ''llm'' THEN 1 ELSE 0 END), 0)) AS error_rate,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = ''llm'') AS total_duration_ms,
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = ''llm'') AS avg_duration_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = ''llm'') AS p95_duration_ms,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = ''llm'') AS p99_duration_ms,
                SUM(total_tokens) FILTER (WHERE run_type = ''llm'') AS total_tokens_sum,
                AVG(total_tokens) FILTER (WHERE run_type = ''llm'') AS avg_tokens_per_run,
                AVG(time_to_first_token) FILTER (WHERE run_type = ''llm'') AS avg_ttft_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY time_to_first_token)
                    FILTER (WHERE run_type = ''llm'') AS p95_ttft_ms,
                COUNT(DISTINCT user_id) FILTER (WHERE run_type = ''llm'') AS distinct_users
            FROM runs
            GROUP BY time_bucket(''1 week'', start_time), model_name, system
        ');

        -- 配置周级聚合刷新策略
        PERFORM add_continuous_aggregate_policy('run_stats_weekly',
            start_offset => INTERVAL '1 week',
            end_offset => INTERVAL '1 day',
            schedule_interval => INTERVAL '1 hour',
            if_not_exists => TRUE
        );

        -- 创建索引
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_run_stats_weekly_lookup
            ON run_stats_weekly (stat_period DESC, model_name, system)';

        RAISE NOTICE 'Created continuous aggregate view: run_stats_weekly';
    ELSE
        RAISE NOTICE 'Continuous aggregate view run_stats_weekly already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating continuous aggregate run_stats_weekly: %', SQLERRM;
END $$;

-- 3.5 月级聚合视图
DO $$
BEGIN
    -- 检查视图是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = 'run_stats_monthly'
    ) THEN
        EXECUTE format('
            CREATE MATERIALIZED VIEW run_stats_monthly
            WITH (timescaledb.continuous)
            AS
            SELECT
                time_bucket(''1 month'', start_time) AS stat_period,
                model_name,
                system,
                COUNT(*) FILTER (WHERE run_type = ''llm'') AS total_runs,
                SUM(CASE WHEN run_type = ''llm'' AND error IS NULL THEN 1 ELSE 0 END) AS successful_runs,
                SUM(CASE WHEN run_type = ''llm'' AND error IS NOT NULL THEN 1 ELSE 0 END) AS failed_runs,
                (SUM(CASE WHEN run_type = ''llm'' AND error IS NOT NULL THEN 1 ELSE 0 END)::FLOAT /
                 NULLIF(SUM(CASE WHEN run_type = ''llm'' THEN 1 ELSE 0 END), 0)) AS error_rate,
                SUM(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = ''llm'') AS total_duration_ms,
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = ''llm'') AS avg_duration_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = ''llm'') AS p95_duration_ms,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)
                    FILTER (WHERE run_type = ''llm'') AS p99_duration_ms,
                SUM(total_tokens) FILTER (WHERE run_type = ''llm'') AS total_tokens_sum,
                AVG(total_tokens) FILTER (WHERE run_type = ''llm'') AS avg_tokens_per_run,
                AVG(time_to_first_token) FILTER (WHERE run_type = ''llm'') AS avg_ttft_ms,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY time_to_first_token)
                    FILTER (WHERE run_type = ''llm'') AS p95_ttft_ms,
                COUNT(DISTINCT user_id) FILTER (WHERE run_type = ''llm'') AS distinct_users
            FROM runs
            GROUP BY time_bucket(''1 month'', start_time), model_name, system
        ');

        -- 配置月级聚合刷新策略
        PERFORM add_continuous_aggregate_policy('run_stats_monthly',
            start_offset => INTERVAL '1 month',
            end_offset => INTERVAL '1 day',
            schedule_interval => INTERVAL '1 day',
            if_not_exists => TRUE
        );

        -- 创建索引
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_run_stats_monthly_lookup
            ON run_stats_monthly (stat_period DESC, model_name, system)';

        RAISE NOTICE 'Created continuous aggregate view: run_stats_monthly';
    ELSE
        RAISE NOTICE 'Continuous aggregate view run_stats_monthly already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating continuous aggregate run_stats_monthly: %', SQLERRM;
END $$;

-- =====================================================
-- 4. 创建辅助函数
-- =====================================================

-- 4.1 更新 updated_at 字段的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4.2 为需要的表创建触发器
DROP TRIGGER IF EXISTS trigger_update_systems_updated_at ON systems;
CREATE TRIGGER trigger_update_systems_updated_at
BEFORE UPDATE ON systems
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_runs_updated_at ON runs;
CREATE TRIGGER trigger_update_runs_updated_at
BEFORE UPDATE ON runs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. 清理旧的触发器和表（如果存在）
-- =====================================================

-- 删除旧的统计更新触发器
DROP TRIGGER IF EXISTS trigger_update_stats_raw ON runs;

-- 删除旧的触发器函数
DROP FUNCTION IF EXISTS update_stats_raw();

-- 删除旧的 run_stats_raw 表（如果存在）
DROP TABLE IF EXISTS run_stats_raw CASCADE;

-- =====================================================
-- 6. 验证初始化
-- =====================================================

-- 显示所有创建的表
SELECT 'Tables created:' AS info;
SELECT schemaname, tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 显示所有超表
SELECT 'Hypertables created:' AS info;
SELECT hypertable_schema, hypertable_name, time_column_name
FROM timescaledb_information.hypertables
ORDER BY hypertable_name;

-- 显示所有连续聚合视图
SELECT 'Continuous aggregates created:' AS info;
SELECT view_schema, view_name, materialization_interval, refresh_lag
FROM timescaledb_information.continuous_aggregates
ORDER BY view_name;

-- 完成
SELECT 'TimescaleDB initialization completed successfully!' AS status;
SELECT 'Continuous aggregates now query runs table directly (no intermediate run_stats_raw table)' AS info;
SELECT 'Only LLM runs are included in statistics (run_type = ''llm'')' AS info;
