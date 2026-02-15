-- Open Smith TimescaleDB 实时聚合启用脚本
-- 版本: 1.0
-- 创建日期: 2026-02-15
-- 描述: 启用连续聚合视图的实时聚合功能，使查询包含最新的未物化数据

-- =====================================================
-- 启用实时聚合
-- =====================================================

-- 实时聚合允许查询连续聚合视图时包含最新的未物化数据
-- 通过将 materialized_only 设置为 false 来启用
-- 这会将未物化的原始数据与物化数据合并，提供实时的查询结果

-- 1. 启用小时级聚合的实时聚合
DO $$
BEGIN
    -- 检查视图是否存在
    IF EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = 'run_stats_hourly'
    ) THEN
        EXECUTE 'ALTER MATERIALIZED VIEW run_stats_hourly SET (timescaledb.materialized_only = false)';
        RAISE NOTICE 'Enabled real-time aggregation for run_stats_hourly';
    ELSE
        RAISE NOTICE 'Continuous aggregate run_stats_hourly does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error enabling real-time aggregation for run_stats_hourly: %', SQLERRM;
END $$;

-- 2. 启用 15分钟级聚合的实时聚合
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = 'run_stats_15min'
    ) THEN
        EXECUTE 'ALTER MATERIALIZED VIEW run_stats_15min SET (timescaledb.materialized_only = false)';
        RAISE NOTICE 'Enabled real-time aggregation for run_stats_15min';
    ELSE
        RAISE NOTICE 'Continuous aggregate run_stats_15min does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error enabling real-time aggregation for run_stats_15min: %', SQLERRM;
END $$;

-- 3. 启用天级聚合的实时聚合
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = 'run_stats_daily'
    ) THEN
        EXECUTE 'ALTER MATERIALIZED VIEW run_stats_daily SET (timescaledb.materialized_only = false)';
        RAISE NOTICE 'Enabled real-time aggregation for run_stats_daily';
    ELSE
        RAISE NOTICE 'Continuous aggregate run_stats_daily does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error enabling real-time aggregation for run_stats_daily: %', SQLERRM;
END $$;

-- 4. 启用周级聚合的实时聚合
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = 'run_stats_weekly'
    ) THEN
        EXECUTE 'ALTER MATERIALIZED VIEW run_stats_weekly SET (timescaledb.materialized_only = false)';
        RAISE NOTICE 'Enabled real-time aggregation for run_stats_weekly';
    ELSE
        RAISE NOTICE 'Continuous aggregate run_stats_weekly does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error enabling real-time aggregation for run_stats_weekly: %', SQLERRM;
END $$;

-- 5. 启用月级聚合的实时聚合
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = 'run_stats_monthly'
    ) THEN
        EXECUTE 'ALTER MATERIALIZED VIEW run_stats_monthly SET (timescaledb.materialized_only = false)';
        RAISE NOTICE 'Enabled real-time aggregation for run_stats_monthly';
    ELSE
        RAISE NOTICE 'Continuous aggregate run_stats_monthly does not exist';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error enabling real-time aggregation for run_stats_monthly: %', SQLERRM;
END $$;

-- =====================================================
-- 验证实时聚合状态
-- =====================================================

SELECT 'Real-time aggregation status:' AS info;
SELECT
    view_name,
    materialization_only as "materialized_only",
    finalized
FROM timescaledb_information.continuous_aggregates
ORDER BY view_name;

-- =====================================================
-- 完成
-- =====================================================

SELECT 'Real-time aggregation enabled for all continuous aggregates!' AS status;
SELECT 'Queries will now include both materialized and recent unmaterialized data' AS info;

-- =====================================================
-- 注意事项
-- =====================================================

/*
重要提示：
1. 启用实时聚合后，查询会合并物化数据和未物化的原始数据
2. 这会确保查询结果包含最新的数据，但可能会略微增加查询延迟
3. 水印（watermark）决定了哪些数据是未物化的：
   - 位于水印之后的数据被视为未物化数据
   - 位于水印之前或等于水印的数据是已物化数据
4. 刷新策略的 end_offset 决定了水印的位置：
   - 例如：end_offset => INTERVAL '1 minute' 意味着最后 1 分钟的数据不会被物化
5. 如果需要禁用实时聚合（只返回已物化数据），执行：
   ALTER MATERIALIZED VIEW <view_name> SET (timescaledb.materialized_only = true);
*/
