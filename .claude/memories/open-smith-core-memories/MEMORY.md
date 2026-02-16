---
name: "open-smith-core-memories"
description: "Open Smith 项目核心知识：包含 TimescaleDB hypertable 架构约束（主键包含分区列、无外键、连续聚合 WITH NO DATA）、数据库架构迁移（移除 run_stats_raw 直接在 runs 表聚合）、统计条件修复（只统计 run_type='llm'）、前端字段映射修复；适用于 LangSmith + TimescaleDB 追踪系统"
tags: ["timescaledb", "hypertable", "database", "architecture", "migration", "bug-fix", "langsmith"]
category: "architecture"
created: "2026-02-15"
last_updated: "2026-02-15"
priority: "high"
context_scope: "project"
---

## 背景

Open Smith 项目的核心知识，涵盖 TimescaleDB 架构约束、数据库迁移、统计修复等关键内容。主要解决了 TimescaleDB hypertable 的特殊要求、中间表迁移、统计条件错误等关键问题。

---

## 一、TimescaleDB Hypertable 架构约束

### 1.1 主键必须包含分区列

**问题**：TimescaleDB 要求当表有主键约束时，分区列必须包含在主键中（错误代码 TS103）。

**解决方案**：将单列主键改为复合主键。

```sql
-- runs 表（按 start_time 分区）
PRIMARY KEY (id, start_time)

-- run_stats_raw 表（按 stat_hour 分区）
PRIMARY KEY (id, stat_hour)
```

**文件位置**：`sql/init-timescaledb.sql:64-67`

### 1.2 无法使用外键约束

**问题**：由于 hypertable 使用复合主键 `(id, start_time)`，其他表无法只引用 `id` 列创建外键约束。PostgreSQL 要求外键必须引用完整的主键列。

**解决方案**：移除外键约束，应用层确保数据一致性。

```sql
-- feedback 表和 attachments 表
-- 移除外键约束，添加注释说明应用层需确保数据一致性
```

**文件位置**：`sql/init-timescaledb.sql:95-105`

### 1.3 连续聚合视图配置约束

**问题 1**：`CREATE MATERIALIZED VIEW ... WITH DATA` 不能在事务块中运行。

**解决方案**：添加 `WITH NO DATA` 选项。

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS run_stats_hourly
WITH (timescaledb.continuous, timescaledb.materialized_only)
AS SELECT ...
WITH NO DATA;
```

**文件位置**：`sql/init-timescaledb.sql:184-242`

**问题 2**：刷新窗口太小（`policy refresh window too small`），要求 start 和 end offset 至少覆盖 2 个 bucket。

**解决方案**：调整刷新策略参数。

```sql
-- 小时级聚合（1小时 bucket）
SELECT add_continuous_aggregate_policy('run_stats_hourly',
    start_offset INTERVAL '3 hours',  -- 至少2个bucket
    end_offset INTERVAL '1 hour',
    schedule_interval INTERVAL '5 minutes',
    if_not_exists TRUE
);

-- 其他粒度相应调整
```

### 1.4 SQL 语句分割器增强

**问题**：原有分割器无法正确识别 PostgreSQL 的 `$$` 分隔符（用于 PL/pgSQL 块），导致 DO 块和函数定义被错误分割。

**解决方案**：在 `src/database/base-database.ts:43-120` 中增强 `splitSqlStatements` 方法，添加 `inDollarQuote` 状态跟踪。

```typescript
// 关键逻辑：在 inDollarQuote 状态下不进行语句分割
if (!inString && !inComment && char === '$' && i + 1 < sqlScript.length && sqlScript[i + 1] === '$') {
    if (!inDollarQuote) {
        inDollarQuote = true;
        // 检测标签
    } else {
        inDollarQuote = false;
        // 匹配标签
    }
}

// 在 $$ 块内不分割语句
else if (char === ';' && !inString && !inComment && !inDollarQuote) {
    // 分割语句
}
```

### 1.5 连续聚合视图索引

**问题**：连续聚合视图不支持唯一约束，因为它们会被自动刷新。

**解决方案**：使用普通索引代替唯一索引。

```sql
-- 普通索引
CREATE INDEX IF NOT EXISTS idx_run_stats_hourly_lookup
ON run_stats_hourly (stat_hour DESC, model_name, system);
```

---

## 二、数据库架构迁移：移除 run_stats_raw 中间表

### 2.1 架构对比

**旧架构**：
```
runs 表 → [触发器 trigger_update_stats_raw] → run_stats_raw 表 → [连续聚合] → run_stats_hourly/15min/...
```

**新架构**：
```
runs 表（hypertable） → [连续聚合直接查询，使用 FILTER 子句] → run_stats_hourly/15min/...
```

### 2.2 迁移原因

- 简化架构，减少维护成本
- 节省约 50% 统计数据存储
- 消除触发器导致的数据同步问题
- 提升统计实时性，无触发器延迟

### 2.3 关键修改

#### 1. sql/init-timescaledb.sql

**移除内容**：
- run_stats_raw 表创建（整个部分）
- 触发器和函数 `update_stats_raw()`, `trigger_update_stats_raw`

**修改连续聚合视图**（所有5个粒度：hourly, 15min, daily, weekly, monthly）：

```sql
CREATE MATERIALIZED VIEW run_stats_hourly
WITH (timescaledb.continuous)
AS
SELECT
    time_bucket('1 hour', start_time) AS stat_hour,
    model_name,
    system,
    COUNT(*) FILTER (WHERE run_type = 'llm') AS total_runs,
    SUM(CASE WHEN run_type = 'llm' AND error IS NULL THEN 1 ELSE 0 END) AS successful_runs,
    SUM(CASE WHEN run_type = 'llm' AND error IS NOT NULL THEN 1 ELSE 0 END) AS failed_runs,
    (SUM(CASE WHEN run_type = 'llm' AND error IS NOT NULL THEN 1 ELSE 0 END)::FLOAT /
     NULLIF(SUM(CASE WHEN run_type = 'llm' THEN 1 ELSE 0 END), 0)) AS error_rate,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = 'llm') AS total_duration_ms,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000) FILTER (WHERE run_type = 'llm') AS avg_duration_ms,
    SUM(total_tokens) FILTER (WHERE run_type = 'llm') AS total_tokens_sum,
    AVG(total_tokens) FILTER (WHERE run_type = 'llm') AS avg_tokens_per_run,
    AVG(time_to_first_token) FILTER (WHERE run_type = 'llm') AS avg_ttft_ms,
    COUNT(DISTINCT user_id) FILTER (WHERE run_type = 'llm') AS distinct_users
FROM runs
GROUP BY time_bucket('1 hour', start_time), model_name, system
WITH NO DATA;
```

**关键变化**：
- 从 `run_stats_raw` 改为 `runs` 表
- 时间字段从 `stat_hour` 改为 `start_time`
- 使用 `FILTER (WHERE run_type = 'llm')` 替代原触发器逻辑
- 使用 `EXTRACT(EPOCH FROM (end_time - start_time)) * 1000` 动态计算 duration

#### 2. src/database/base-database.ts

**移除 run_stats_raw 验证**：
```typescript
const requiredTables = ['systems', 'runs', 'feedback', 'attachments'];
```

#### 3. src/database/schema.ts

**删除 RunStatsRawTable 接口**（完整移除）

**从 Database 接口移除**：`run_stats_raw: RunStatsRawTable;`

#### 4. src/database/repositories/run-stats-repository.ts

仅更新注释，说明新架构为直接在 runs 表上创建连续聚合。

### 2.4 迁移脚本

#### scripts/cleanup-database.js

清理旧的数据库对象：
- 删除所有连续聚合视图（5个）
- 删除触发器 `trigger_update_stats_raw`
- 删除触发器函数 `update_stats_raw()`
- 删除 `run_stats_raw` 表

#### scripts/migrate-to-hypertable.js

将现有的 runs 表迁移为 TimescaleDB hypertable：
1. 创建 runs_new hypertable
2. 复制数据（包括外键约束）
3. 创建索引
4. 删除旧 runs 表
5. 重命名 runs_new → runs
6. 验证数据完整性

### 2.5 旧项目迁移步骤

1. 停止应用
2. 执行 cleanup-database.js 清理旧对象
3. 执行 migrate-to-hypertable.js 转换 runs 表为 hypertable（如果还不是）
4. 重启应用，应用自动创建新架构

### 2.6 新项目部署要求

**无需迁移步骤**，直接使用修改后的代码，但前提条件：

1. **必须预先安装 TimescaleDB 扩展**
2. TimescaleDB 版本必须 ≥ 2.10（支持 FILTER 子句）
3. PostgreSQL 版本 ≥ 14

**启动流程**：
```bash
# 配置环境变量
TRACE_DATABASE_URL=postgresql://user:password@host:port/database

# 直接启动
pnpm dev
```

应用自动完成：
- 创建所有表
- 将 runs 表转换为 hypertable
- 创建连续聚合视图（直接在 runs 表上）
- 创建索引
- 启用实时聚合

---

## 三、统计条件 Bug 修复

### 3.1 问题描述

TimescaleDB 连续聚合视图在统计 LLM 运行数据时，使用了 `WHERE run_type = 'llm' OR run_type IS NULL` 条件，导致统计了所有 run_type 为空的记录（可能包括 chain、tool、retriever 等非 LLM 类型的运行），使统计数据偏大。

### 3.2 根本原因

连续聚合视图在 5 个粒度（15min、1h、1d、1w、1m）中都使用了错误的过滤条件：

```sql
-- 错误：包含 run_type IS NULL
COUNT(*) FILTER (WHERE run_type = 'llm' OR run_type IS NULL) AS total_runs
```

这导致所有 `run_type IS NULL` 的记录也被统计进 LLM 运行次数。

### 3.3 解决方案

#### 1. 修复聚合视图统计条件

修改所有 12 个统计指标的过滤条件，移除 `OR run_type IS NULL`：

```sql
-- 正确：只统计 run_type = 'llm'
COUNT(*) FILTER (WHERE run_type = 'llm') AS total_runs
SUM(CASE WHEN run_type = 'llm' AND error IS NULL THEN 1 ELSE 0 END) AS successful_runs
SUM(CASE WHEN run_type = 'llm' AND error IS NOT NULL THEN 1 ELSE 0 END) AS failed_runs
```

**受影响的指标**（12个）：
- total_runs, successful_runs, failed_runs, error_rate
- total_duration_ms, avg_duration_ms, p95_duration_ms, p99_duration_ms
- total_tokens_sum, avg_tokens_per_run
- avg_ttft_ms, p95_ttft_ms
- distinct_users

**涉及 5 个粒度聚合视图**：run_stats_15min, run_stats_hourly, run_stats_daily, run_stats_weekly, run_stats_monthly

#### 2. 创建修复脚本

**`sql/fix-run-stats-llm-only.sql`**：完整修复脚本
- 删除并重建 5 个聚合视图
- 应用修正后的过滤条件
- 自动刷新所有聚合视图
- 启用实时聚合

**`sql/MIGRATION_GUIDE.md`**：详细迁移指南
- 问题说明和影响范围
- 两种修复方案对比
- 验证和回滚步骤

#### 3. 更新初始化脚本

更新 `sql/init-timescaledb.sql`（v2.2 → v2.3），确保新部署直接使用正确的统计条件。

#### 4. 修复前端字段映射

修改 `frontend/pages/StatsPage.tsx:173,217`：

```typescript
// 修正前
"total_tokens";

// 修正后
"total_tokens_sum";
```

#### 5. 修复 Chart 组件

修改 `frontend/components/Chart.tsx`，添加缺失的控制器和元素：

```typescript
import { DoughnutController, ArcElement } from "chart.js";

ChartJS.register(
    // ... 其他控制器
    DoughnutController,
    ArcElement,
);
```

### 3.4 执行步骤

#### 现有数据库

```bash
psql -h localhost -U your_user -d your_database \
  -f /path/to/sql/fix-run-stats-llm-only.sql
```

#### 新部署

直接使用更新后的 `sql/init-timescaledb.sql` 初始化。

### 3.5 验证

```sql
-- 检查聚合视图定义
SELECT view_definition
FROM information_schema.views
WHERE table_name = 'run_stats_hourly';

-- 检查统计数据
SELECT stat_hour, model_name, system, total_runs
FROM run_stats_hourly
ORDER BY stat_hour DESC
LIMIT 10;
```

### 3.6 注意事项

- 修复后统计数可能减少（之前包含了非 LLM 记录）
- 需要刷新聚合视图后才能看到正确数据
- 如果历史数据中大量 run_type 为 NULL，建议先分析这些记录的类型再执行修复

---

## 四、适用场景和注意事项

### 4.1 适用场景

- ✅ TimescaleDB + PostgreSQL 时间序列数据库
- ✅ 需要使用 hypertable 进行分区的场景
- ✅ LangSmith 追踪数据存储
- ✅ 需要连续聚合进行数据分析的场景

### 4.2 不适用场景

- ❌ 不需要分区的小规模数据
- ❌ 需要严格外键约束的场景
- ❌ 其他非 PostgreSQL 数据库

### 4.3 关键注意事项

1. **数据一致性**：移除外键约束后，应用层必须确保引用数据的完整性
2. **性能考虑**：连续聚合视图的刷新策略需要根据数据量调整，避免刷新窗口太小导致性能问题
3. **开发环境**：清理旧表的 DO 块会删除所有数据，仅适用于开发环境
4. **版本要求**：TimescaleDB 2.10+ 是硬性要求，FILTER 子句支持是关键
5. **数据一致性验证**：迁移后需验证统计数据准确性（可对比原始 runs 表和聚合视图）
6. **性能监控**：新架构下聚合查询性能可能不同，建议监控 P95/P99 延迟
7. **回滚方案**：旧项目迁移建议备份数据，保留回滚脚本

### 4.4 后续优化建议

1. 添加数据压缩策略（7 天前数据压缩）
2. 配置数据保留策略（90 天数据保留）
3. 监控连续聚合视图的刷新性能
4. 考虑使用分区键索引优化查询性能

---

## 五、关键文件索引

| 文件路径 | 用途 |
|---------|------|
| `src/database/base-database.ts` | SQL 语句分割器增强、表验证 |
| `sql/init-timescaledb.sql` | 数据库初始化脚本（v2.3） |
| `sql/fix-run-stats-llm-only.sql` | 统计条件修复脚本 |
| `sql/MIGRATION_GUIDE.md` | 迁移指南 |
| `scripts/cleanup-database.js` | 清理旧数据库对象 |
| `scripts/migrate-to-hypertable.js` | 迁移到 hypertable |
| `src/database/schema.ts` | 数据库类型定义 |
| `frontend/pages/StatsPage.tsx` | 统计页面（字段映射修复） |
| `frontend/components/Chart.tsx` | 图表组件（控制器修复） |

---

## 六、快速参考

### 6.1 连续聚合刷新策略配置

| 粒度 | Bucket 大小 | Start Offset | End Offset |
|------|------------|--------------|-----------|
| 15min | 15 分钟 | 1 hour | 15 minutes |
| 1h | 1 小时 | 3 hours | 1 hour |
| 1d | 1 天 | 2 days | 1 day |
| 1w | 1 周 | 2 weeks | 1 week |
| 1m | 1 月 | 2 months | 1 month |

### 6.2 数据库版本要求

- PostgreSQL ≥ 14
- TimescaleDB ≥ 2.10

### 6.3 关键 SQL 语句

```sql
-- 创建 hypertable
SELECT create_hypertable('runs', 'start_time', if_not_exists => TRUE);

-- 刷新连续聚合
CALL refresh_continuous_aggregate('run_stats_hourly', NULL, NULL);

-- 添加刷新策略
SELECT add_continuous_aggregate_policy('run_stats_hourly',
    start_offset INTERVAL '3 hours',
    end_offset INTERVAL '1 hour',
    schedule_interval INTERVAL '5 minutes',
    if_not_exists TRUE
);
```

---

## 七、故障排查

### 7.1 常见错误

| 错误代码 | 描述 | 解决方案 |
|---------|------|---------|
| TS103 | Hypertable 主键必须包含分区列 | 使用复合主键 (id, partition_column) |
| 刷新窗口太小 | policy refresh window too small | 调整 start_offset 至少覆盖 2 个 bucket |
| 事务块错误 | 不能在事务中创建带数据的物化视图 | 使用 WITH NO DATA 选项 |

### 7.2 调试命令

```sql
-- 检查 hypertable 状态
SELECT * FROM timescaledb_information.hypertables;

-- 检查连续聚合状态
SELECT * FROM timescaledb_information.continuous_aggregates;

-- 检查刷新策略
SELECT * FROM timescaledb_information.jobs;

-- 检查连续聚合刷新状态
SELECT * FROM timescaledb_information.continuous_aggregate_stats;
```

---

## 八、影响范围

### 8.1 数据库层

- 5 个连续聚合视图（run_stats_15min, run_stats_hourly, run_stats_daily, run_stats_weekly, run_stats_monthly）
- runs 表（hypertable）
- systems, feedback, attachments 表

### 8.2 后端层

- `RunStatsRepository.getStats()` 返回的数据
- `BaseDatabase` 初始化逻辑
- 数据库 schema 类型定义

### 8.3 前端层

- `StatsPage.tsx` 的图表和数据表格显示
- `Chart.tsx` 组件的控制器注册

---

*最后更新: 2026-02-15*
