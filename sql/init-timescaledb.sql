-- Open Smith TimescaleDB 数据库初始化脚本
-- 版本: 1.0
-- 创建日期: 2026-02-15

-- =====================================================
-- 0. 清理旧表（如果存在且结构不正确）
-- =====================================================

-- 如果 runs 表存在但使用旧的单列主键，需要删除它
-- 注意：这会删除所有现有数据！仅用于开发环境
DO $$
BEGIN
    -- 检查 runs 表是否是 hypertable
    IF EXISTS (SELECT 1 FROM timescaledb_information.hypertables WHERE hypertable_name = 'runs') THEN
        -- 删除 hypertable
        PERFORM drop_chunks('runs', newer_than => NOW());
    END IF;

    -- 删除表（如果存在）
    DROP TABLE IF EXISTS run_stats_monthly CASCADE;
    DROP TABLE IF EXISTS run_stats_weekly CASCADE;
    DROP TABLE IF EXISTS run_stats_daily CASCADE;
    DROP TABLE IF EXISTS run_stats_15min CASCADE;
    DROP TABLE IF EXISTS run_stats_hourly CASCADE;
    DROP TABLE IF EXISTS run_stats_raw CASCADE;
    DROP TABLE IF EXISTS runs CASCADE;
    DROP TABLE IF EXISTS feedback CASCADE;
    DROP TABLE IF EXISTS attachments CASCADE;
    DROP TABLE IF EXISTS systems CASCADE;

    -- 删除旧的触发器函数
    DROP FUNCTION IF EXISTS update_stats_raw() CASCADE;
    DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

    RAISE NOTICE 'Old tables and functions dropped';
END $$;

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
SELECT create_hypertable('runs', 'start_time', if_not_exists => TRUE);

-- 为 runs 表的 id 列添加唯一约束（用于外键引用）
-- 注意：虽然在 TimescaleDB hypertable 上创建唯一约束有限制，
-- 但我们需要确保 id 列是唯一的，以便其他表可以引用它
-- 由于 (id, start_time) 已经是主键，id 本身实际上就是唯一的
-- PostgreSQL 在复合主键上允许引用单个列，只要该列在主键中

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
-- 3. 创建统计原始数据表 (Hypertable)
-- =====================================================

-- 3.1 创建 run_stats_raw 表 (用于连续聚合)
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
);

-- 创建超表，按 stat_hour 分区
SELECT create_hypertable('run_stats_raw', 'stat_hour', if_not_exists => TRUE);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_run_stats_raw_system ON run_stats_raw (system);
CREATE INDEX IF NOT EXISTS idx_run_stats_raw_model_name ON run_stats_raw (model_name);
CREATE INDEX IF NOT EXISTS idx_run_stats_raw_stat_hour ON run_stats_raw (stat_hour DESC);

-- =====================================================
-- 4. 创建连续聚合视图
-- =====================================================

-- 4.1 小时级聚合视图
CREATE MATERIALIZED VIEW IF NOT EXISTS run_stats_hourly
WITH (timescaledb.continuous)
AS
SELECT
    time_bucket('1 hour', stat_hour) AS stat_hour,
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
GROUP BY time_bucket('1 hour', stat_hour), model_name, system
WITH NO DATA;

-- 配置小时级聚合刷新策略
SELECT add_continuous_aggregate_policy('run_stats_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => TRUE
);

-- Note: Continuous aggregates should not have unique constraints as they are automatically refreshed
-- Use regular index for query performance instead
CREATE INDEX IF NOT EXISTS idx_run_stats_hourly_lookup
ON run_stats_hourly (stat_hour DESC, model_name, system);

-- 4.2 15分钟级聚合视图
CREATE MATERIALIZED VIEW IF NOT EXISTS run_stats_15min
WITH (timescaledb.continuous)
AS
SELECT
    time_bucket('15 minutes', stat_hour) AS stat_period,
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
GROUP BY time_bucket('15 minutes', stat_hour), model_name, system
WITH NO DATA;

-- 配置 15分钟级聚合刷新策略
SELECT add_continuous_aggregate_policy('run_stats_15min',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '2 minutes',
    if_not_exists => TRUE
);

-- Note: Continuous aggregates should not have unique constraints as they are automatically refreshed
-- Use regular index for query performance instead
CREATE INDEX IF NOT EXISTS idx_run_stats_15min_lookup
ON run_stats_15min (stat_period DESC, model_name, system);

-- 4.3 天级聚合视图
CREATE MATERIALIZED VIEW IF NOT EXISTS run_stats_daily
WITH (timescaledb.continuous)
AS
SELECT
    time_bucket('1 day', stat_hour) AS stat_period,
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
GROUP BY time_bucket('1 day', stat_hour), model_name, system;

-- 配置天级聚合刷新策略
SELECT add_continuous_aggregate_policy('run_stats_daily',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes',
    if_not_exists => TRUE
);

-- Note: Continuous aggregates should not have unique constraints as they are automatically refreshed
-- Use regular index for query performance instead
CREATE INDEX IF NOT EXISTS idx_run_stats_daily_lookup
ON run_stats_daily (stat_period DESC, model_name, system);

-- 4.4 周级聚合视图
CREATE MATERIALIZED VIEW IF NOT EXISTS run_stats_weekly
WITH (timescaledb.continuous)
AS
SELECT
    time_bucket('1 week', stat_hour) AS stat_period,
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
GROUP BY time_bucket('1 week', stat_hour), model_name, system;

-- 配置周级聚合刷新策略
SELECT add_continuous_aggregate_policy('run_stats_weekly',
    start_offset => INTERVAL '1 week',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Note: Continuous aggregates should not have unique constraints as they are automatically refreshed
-- Use regular index for query performance instead
CREATE INDEX IF NOT EXISTS idx_run_stats_weekly_lookup
ON run_stats_weekly (stat_period DESC, model_name, system);

-- 4.5 月级聚合视图
CREATE MATERIALIZED VIEW IF NOT EXISTS run_stats_monthly
WITH (timescaledb.continuous)
AS
SELECT
    time_bucket('1 month', stat_hour) AS stat_period,
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
GROUP BY time_bucket('1 month', stat_hour), model_name, system;

-- 配置月级聚合刷新策略
SELECT add_continuous_aggregate_policy('run_stats_monthly',
    start_offset => INTERVAL '1 month',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Note: Continuous aggregates should not have unique constraints as they are automatically refreshed
-- Use regular index for query performance instead
CREATE INDEX IF NOT EXISTS idx_run_stats_monthly_lookup
ON run_stats_monthly (stat_period DESC, model_name, system);

-- =====================================================
-- 5. 创建触发器和函数
-- =====================================================

-- 5.1 创建更新统计数据的触发器函数
CREATE OR REPLACE FUNCTION update_stats_raw()
RETURNS TRIGGER AS $$
BEGIN
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
$$ LANGUAGE plpgsql;

-- 5.2 创建触发器
DROP TRIGGER IF EXISTS trigger_update_stats_raw ON runs;
CREATE TRIGGER trigger_update_stats_raw
AFTER INSERT ON runs
FOR EACH ROW
EXECUTE FUNCTION update_stats_raw();

-- =====================================================
-- 6. 创建辅助函数
-- =====================================================

-- 6.1 更新 updated_at 字段的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6.2 为需要的表创建触发器
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
-- 7. 数据压缩策略 (可选)
-- =====================================================

-- 7.1 配置 runs 表压缩
-- 注意: 根据实际需求决定是否启用压缩
-- ALTER TABLE runs SET (
--     timescaledb.compress,
--     timescaledb.compress_segmentby = 'system,model_name',
--     timescaledb.compress_orderby = 'start_time DESC'
-- );

-- 7.2 添加压缩策略 (压缩 7 天前的数据)
-- SELECT add_compression_policy('runs',
--     INTERVAL '7 days',
--     compress_after => INTERVAL '30 days',
--     if_not_exists => TRUE
-- );

-- =====================================================
-- 8. 数据保留策略 (可选)
-- =====================================================

-- 根据需求配置数据保留策略
-- 例如: 保留 90 天的数据
-- SELECT add_retention_policy('runs', INTERVAL '90 days');
-- SELECT add_retention_policy('run_stats_raw', INTERVAL '90 days');

-- =====================================================
-- 9. 验证初始化
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
