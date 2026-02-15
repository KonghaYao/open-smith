# Open Smith 数据分析重构规格文档

**版本**: 1.0
**创建日期**: 2026-02-15
**状态**: Draft

---

## 1. 项目概述

### 1.1 背景

Open Smith 当前使用 SQLite 作为数据存储，数据分析能力受限。为了提供更强大的时序数据分析能力，决定将底层存储迁移到 TimescaleDB，并重构数据分析相关的 API。

### 1.2 目标

1. **数据库迁移**: 将所有数据表从 SQLite 迁移到 TimescaleDB
2. **API 重构**: 完全重构数据分析相关的 API 接口，其他接口保持不变
3. **功能增强**: 支持实时数据可视化、多粒度时序聚合、异常检测、性能对比分析
4. **部署优化**: 提供 Docker Compose 一键部署方案

### 1.3 非目标

- **历史数据迁移**: 不需要迁移现有的 SQLite 数据，从零开始
- **向后兼容**: 数据分析 API 不需要保持向后兼容，可以完全重新设计

---

## 2. 技术选型

### 2.1 数据库

#### 选择: TimescaleDB (PostgreSQL 扩展)

**理由**:
- 原生支持时序数据，针对时间序列查询优化
- 提供自动分区、压缩、连续聚合等功能
- 完全兼容 PostgreSQL，可以使用丰富的 SQL 生态
- 支持时序函数（time_bucket, histogram, etc.）
- 社区活跃，文档完善

**替代方案**:
- InfluxDB: 不兼容 SQL，需要学习新查询语言
- ClickHouse: 适合大规模数据分析，但配置复杂

### 2.2 ORM/查询构建器

#### 选择: Kysely (继续使用)

**理由**:
- 项目已在使用，学习成本低
- 类型安全，支持复杂的 SQL 查询
- 可以利用 TimescaleDB 的专用函数
- 轻量级，性能优秀

**增强需求**:
- 扩展 Kysely 以支持 TimescaleDB 特定函数
- 使用 `sql` 模板调用 TimescaleDB 函数

### 2.3 数据库连接

#### 选择: pg (node-postgres)

**理由**:
- PostgreSQL 官方推荐
- 性能优秀，支持连接池
- 与 Kysely 无缝集成

---

## 3. 数据库设计

### 3.1 表结构设计

所有表迁移到 TimescaleDB，根据数据特性选择是否启用超表（Hypertable）特性。

#### 3.1.1 核心表（启用 Hypertable）

**runs 表**
```sql
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  trace_id TEXT,
  name TEXT NOT NULL,
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
  total_tokens INTEGER,
  model_name TEXT,
  time_to_first_token INTEGER,
  tags JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建超表，按 start_time 分区
SELECT create_hypertable('runs', 'start_time');

-- 创建索引
CREATE INDEX idx_runs_system ON runs(system);
CREATE INDEX idx_runs_model_name ON runs(model_name);
CREATE INDEX idx_runs_thread_id ON runs(thread_id);
CREATE INDEX idx_runs_user_id ON runs(user_id);
CREATE INDEX idx_runs_trace_id ON runs(trace_id);
CREATE INDEX idx_runs_run_type ON runs(run_type);
```

**run_stats_hourly 表** (连续聚合)
```sql
-- 原始数据表（可选，用于调试）
CREATE TABLE run_stats_raw (
  stat_hour TIMESTAMPTZ NOT NULL,
  model_name TEXT,
  system TEXT NOT NULL,
  run_id TEXT NOT NULL,
  duration_ms INTEGER,
  token_count INTEGER,
  ttft_ms INTEGER,
  is_success BOOLEAN,
  user_id TEXT
);

SELECT create_hypertable('run_stats_raw', 'stat_hour');

-- 连续聚合视图
CREATE MATERIALIZED VIEW run_stats_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', stat_hour) AS stat_hour,
  model_name,
  system,
  COUNT(*) AS total_runs,
  SUM(CASE WHEN is_success THEN 1 ELSE 0 END) AS successful_runs,
  SUM(CASE WHEN NOT is_success THEN 1 ELSE 0 END) AS failed_runs,
  COUNT(DISTINCT user_id) AS distinct_users,
  SUM(duration_ms) AS total_duration_ms,
  AVG(duration_ms) AS avg_duration_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration_ms,
  SUM(token_count) AS total_tokens_sum,
  AVG(token_count) AS avg_tokens_per_run,
  AVG(ttft_ms) AS avg_ttft_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY ttft_ms) AS p95_ttft_ms
FROM run_stats_raw
GROUP BY time_bucket('1 hour', stat_hour), model_name, system;

-- 配置连续聚合刷新
SELECT add_continuous_aggregate_policy('run_stats_hourly',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '5 minutes'
);
```

**多粒度聚合表**

```sql
-- 15分钟级
CREATE MATERIALIZED VIEW run_stats_15min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', stat_hour) AS stat_period,
  model_name,
  system,
  -- ... 类似指标
FROM run_stats_raw
GROUP BY time_bucket('15 minutes', stat_hour), model_name, system;

-- 天级
CREATE MATERIALIZED VIEW run_stats_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', stat_hour) AS stat_period,
  model_name,
  system,
  -- ... 类似指标
FROM run_stats_raw
GROUP BY time_bucket('1 day', stat_hour), model_name, system;

-- 周级
CREATE MATERIALIZED VIEW run_stats_weekly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 week', stat_hour) AS stat_period,
  model_name,
  system,
  -- ... 类似指标
FROM run_stats_raw
GROUP BY time_bucket('1 week', stat_hour), model_name, system;

-- 月级
CREATE MATERIALIZED VIEW run_stats_monthly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 month', stat_hour) AS stat_period,
  model_name,
  system,
  -- ... 类似指标
FROM run_stats_raw
GROUP BY time_bucket('1 month', stat_hour), model_name, system;
```

#### 3.1.2 辅助表（不启用 Hypertable）

**systems 表**
```sql
CREATE TABLE systems (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  api_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**feedback 表**
```sql
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  feedback_id TEXT NOT NULL,
  score DECIMAL,
  comment TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_feedback_run_id ON feedback(run_id);
CREATE INDEX idx_feedback_trace_id ON feedback(trace_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at);
```

**attachments 表**
```sql
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_attachments_run_id ON attachments(run_id);
```

### 3.2 数据保留策略

根据需求，采用 **永久保留** 策略，不设置自动清理策略。

```sql
-- 不创建数据保留策略
-- 如果未来需要，可以使用:
-- SELECT add_retention_policy('runs', INTERVAL '90 days');
```

### 3.3 数据压缩（可选优化）

TimescaleDB 支持自动压缩历史数据以节省空间：

```sql
-- 压缩策略（可选）
ALTER TABLE runs SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'system,model_name',
  timescaledb.compress_orderby = 'start_time DESC'
);

-- 添加压缩策略（压缩 7 天前的数据）
SELECT add_compression_policy('runs',
  INTERVAL '7 days',
  compress_after => INTERVAL '30 days'
);
```

### 3.4 实时统计更新策略

**方案 A: 触发器 + 队列**
- 在 runs 表插入/更新时，触发器将数据写入 `run_stats_raw`
- 连续聚合自动计算各级指标

**方案 B: 应用层写入**
- 在业务逻辑中，同时写入 runs 和 run_stats_raw
- 连续聚合自动计算

**推荐**: 方案 A（触发器），保证数据一致性。

```sql
-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_stats_raw()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO run_stats_raw (
    stat_hour, model_name, system, run_id,
    duration_ms, token_count, ttft_ms, is_success, user_id
  ) VALUES (
    NEW.start_time, NEW.model_name, NEW.system, NEW.id,
    EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) * 1000,
    COALESCE(NEW.total_tokens, 0),
    NEW.time_to_first_token,
    (NEW.error IS NULL),
    NEW.user_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER trigger_update_stats_raw
AFTER INSERT ON runs
FOR EACH ROW
EXECUTE FUNCTION update_stats_raw();
```

---

## 4. API 重构设计

### 4.1 API 重构范围

**完全重构**:
- `/stats/*` - 所有统计分析接口
- `/trace/search` - 高级搜索接口
- `/trace/traces/search` - 运行搜索接口

**保持不变**:
- `/runs/*` - 数据摄取接口
- `/llm/*` - LLM 调用接口
- `/admin/*` - 系统管理接口
- `/trace/:traceId` - 详情查询接口

### 4.2 新 API 设计原则

1. **RESTful 风格**: 资源导向，使用标准 HTTP 方法
2. **统一响应格式**: 标准化的成功/错误响应
3. **分页支持**: 列表接口支持 `limit` 和 `offset`
4. **过滤参数**: 使用查询参数进行过滤
5. **聚合查询**: 支持多维度聚合

### 4.3 统一响应格式

```typescript
// 成功响应
{
  "success": true,
  "data": any,
  "meta": {
    "total": number,
    "page": number,
    "limit": number
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": string,
    "message": string,
    "details?: any
  }
}
```

### 4.4 核心 API 设计

#### 4.4.1 时序数据聚合 API

**端点**: `GET /api/v1/analytics/timeseries`

**查询参数**:
- `dimension`: 聚合维度（可选）
  - `system` - 按系统
  - `model_name` - 按模型
  - `run_type` - 按类型
  - `user_id` - 按用户
- `metrics`: 指标列表（多个）
  - `total_runs` - 总运行次数
  - `successful_runs` - 成功次数
  - `failed_runs` - 失败次数
  - `error_rate` - 错误率
  - `avg_duration_ms` - 平均延迟
  - `p95_duration_ms` - P95 延迟
  - `p99_duration_ms` - P99 延迟
  - `total_tokens` - 总 Token 数
  - `avg_tokens` - 平均 Token 数
  - `avg_ttft_ms` - 平均首包时间
  - `distinct_users` - 独立用户数
- `granularity`: 时间粒度
  - `5min`, `15min`, `30min`, `1h`, `1d`, `1w`, `1m`
- `start_time`: 开始时间（ISO 8601）
- `end_time`: 结束时间（ISO 8601）
- `filters`: JSON 字符串，高级过滤
  - `system[]` - 系统列表
  - `model_name[]` - 模型列表
  - `run_type[]` - 类型列表
  - `user_id` - 用户 ID
- `limit`: 分页限制（默认 100）
- `offset`: 分页偏移（默认 0）

**请求示例**:
```http
GET /api/v1/analytics/timeseries?
  dimension=system&
  metrics=total_runs,avg_duration_ms,error_rate&
  granularity=1h&
  start_time=2026-02-14T00:00:00Z&
  end_time=2026-02-15T00:00:00Z&
  filters={"system":["system-1","system-2"]}&
  limit=100
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "time": "2026-02-14T00:00:00Z",
      "dimensions": {
        "system": "system-1"
      },
      "metrics": {
        "total_runs": 1250,
        "avg_duration_ms": 2345.5,
        "error_rate": 0.025
      }
    },
    {
      "time": "2026-02-14T00:00:00Z",
      "dimensions": {
        "system": "system-2"
      },
      "metrics": {
        "total_runs": 890,
        "avg_duration_ms": 1890.2,
        "error_rate": 0.015
      }
    }
  ],
  "meta": {
    "total": 168,
    "limit": 100,
    "offset": 0
  }
}
```

**实现要点**:
- 使用 TimescaleDB `time_bucket` 函数
- 根据粒度选择对应的聚合表
- 支持 `GROUP BY` 多个维度
- 使用 Kysely 的 `sql` 模板调用时序函数

#### 4.4.2 趋势分析 API

**端点**: `GET /api/v1/analytics/trends`

**查询参数**:
- `metric`: 趋势指标
- `period`: 对比周期
  - `dod` - 日环比（Day over Day）
  - `wow` - 周环比（Week over Week）
  - `mom` - 月环比（Month over Month）
- `start_time`: 开始时间
- `end_time`: 结束时间
- `filters`: 过滤条件

**响应示例**:
```json
{
  "success": true,
  "data": {
    "current": {
      "value": 2345.5,
      "period": "2026-02-15"
    },
    "previous": {
      "value": 2100.0,
      "period": "2026-02-14"
    },
    "trend": {
      "value": 245.5,
      "percentage": 11.69,
      "direction": "up"
    }
  }
}
```

#### 4.4.3 性能对比 API

**端点**: `GET /api/v1/analytics/compare`

**查询参数**:
- `compare_by`: 对比维度
  - `model` - 按模型对比
  - `system` - 按系统对比
  - `time_period` - 按时间段对比
- `metrics`: 对比指标列表
- `start_time_1`, `end_time_1`: 第一个时间段
- `start_time_2`, `end_time_2`: 第二个时间段（可选，默认为上一个周期）
- `filters`: 过滤条件

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "dimension": {
        "model_name": "gpt-4"
      },
      "period_1": {
        "avg_duration_ms": 2345.5,
        "error_rate": 0.025
      },
      "period_2": {
        "avg_duration_ms": 2100.0,
        "error_rate": 0.015
      },
      "diff": {
        "avg_duration_ms": 245.5,
        "error_rate": 0.01
      }
    },
    {
      "dimension": {
        "model_name": "gpt-3.5-turbo"
      },
      "period_1": {
        "avg_duration_ms": 890.2,
        "error_rate": 0.035
      },
      "period_2": {
        "avg_duration_ms": 850.0,
        "error_rate": 0.032
      },
      "diff": {
        "avg_duration_ms": 40.2,
        "error_rate": 0.003
      }
    }
  ]
}
```

#### 4.4.4 异常检测 API

**端点**: `GET /api/v1/analytics/anomalies`

**查询参数**:
- `metric`: 检测指标
- `start_time`: 开始时间
- `end_time`: 结束时间
- `threshold`: 异常阈值（标准差倍数，默认 3）
- `filters`: 过滤条件

**检测方法**:
- 基于统计的异常检测（Z-Score）
- 滑动窗口统计

**响应示例**:
```json
{
  "success": true,
  "data": {
    "metric": "avg_duration_ms",
    "baseline": {
      "mean": 2345.5,
      "stddev": 450.2,
      "upper_threshold": 3695.9,
      "lower_threshold": 995.1
    },
    "anomalies": [
      {
        "time": "2026-02-15T14:00:00Z",
        "value": 5120.0,
        "z_score": 6.15,
        "severity": "high"
      },
      {
        "time": "2026-02-15T16:00:00Z",
        "value": 4230.0,
        "z_score": 4.18,
        "severity": "medium"
      }
    ]
  }
}
```

#### 4.4.5 统计概览 API

**端点**: `GET /api/v1/analytics/summary`

**查询参数**:
- `start_time`: 开始时间
- `end_time`: 结束时间
- `filters`: 过滤条件

**响应示例**:
```json
{
  "success": true,
  "data": {
    "runs": {
      "total": 125000,
      "successful": 121875,
      "failed": 3125,
      "success_rate": 0.975
    },
    "performance": {
      "avg_duration_ms": 2345.5,
      "p95_duration_ms": 4500.0,
      "p99_duration_ms": 6200.0,
      "avg_ttft_ms": 450.2
    },
    "tokens": {
      "total": 125000000,
      "avg_per_run": 1000
    },
    "users": {
      "distinct": 1250
    },
    "top_models": [
      {
        "model_name": "gpt-4",
        "runs": 50000,
        "avg_duration_ms": 2345.5
      },
      {
        "model_name": "gpt-3.5-turbo",
        "runs": 75000,
        "avg_duration_ms": 890.2
      }
    ]
  }
}
```

#### 4.4.6 自定义查询 API（高级）

**端点**: `POST /api/v1/analytics/query`

**请求体**:
```json
{
  "sql": "SELECT ...",
  "params": {}
}
```

**安全考虑**:
- 限制查询超时时间（默认 30 秒）
- 禁止写操作（INSERT, UPDATE, DELETE, DROP 等）
- 限制返回行数（默认 10000）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "columns": ["time", "system", "total_runs"],
    "rows": [
      ["2026-02-15T00:00:00Z", "system-1", 1250],
      ["2026-02-15T01:00:00Z", "system-1", 1180]
    ]
  },
  "meta": {
    "row_count": 2,
    "execution_time_ms": 45
  }
}
```

### 4.5 API 版本管理

采用 URL 路径版本控制：
- `/api/v1/*` - 当前版本
- 未来升级时，引入 `/api/v2/*`

旧 API 保持不变，不标记废弃，逐步引导用户使用新 API。

---

## 5. 前端改造

### 5.1 StatsPage 重构

**当前实现**:
- 使用旧的 `/stats/hourly` API
- 简单的图表展示

**新实现**:
- 使用新的 `/api/v1/analytics/*` API
- 增强的交互功能：
  - 时间范围选择器（快捷选项 + 自定义）
  - 多指标选择（可同时展示多个指标）
  - 维度切换（系统/模型/类型）
  - 粒度切换（分钟/小时/天）
  - 实时刷新（可选）
- 图表库：继续使用 Chart.js
- 响应式设计

### 5.2 新增页面

#### 5.2.1 TrendComparisonPage
- 趋势对比视图
- 日环比/周环比/月环比

#### 5.2.2 PerformanceComparePage
- 性能对比分析
- 支持多维度对比

#### 5.2.3 AnomalyDetectionPage
- 异常检测结果展示
- 告警配置

### 5.3 数据可视化组件

创建通用图表组件：
- `TimeSeriesChart` - 时序折线图
- `BarChart` - 柱状图
- `MultiLineChart` - 多线对比图
- `AnomalyChart` - 异常检测图表（包含阈值线）

---

## 6. 部署方案

### 6.1 Docker Compose 集成部署

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    container_name: open-smith-db
    environment:
      POSTGRES_USER: open_smith
      POSTGRES_PASSWORD: open_smith_password
      POSTGRES_DB: open_smith
      TIMESCALEDB_TELEMETRY: off
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U open_smith"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    container_name: open-smith-app
    ports:
      - "7765:7765"
    environment:
      TRACE_DATABASE_URL: postgresql://open_smith:open_smith_password@postgres:5432/open_smith
      MASTER_KEY: ${MASTER_KEY}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./attachments:/app/attachments

volumes:
  postgres_data:
```

### 6.2 环境变量

**必需**:
- `TRACE_DATABASE_URL`: PostgreSQL 连接字符串
- `MASTER_KEY`: 管理员密钥

**可选**:
- `ANALYTICS_QUERY_TIMEOUT`: 自定义查询超时（默认 30000ms）
- `ANALYTICS_MAX_ROWS`: 自定义查询最大返回行数（默认 10000）

### 6.3 初始化脚本

创建 `init-db.sh` 脚本，自动：
1. 等待 PostgreSQL 就绪
2. 创建数据库和表
3. 创建超表
4. 创建连续聚合视图
5. 配置刷新策略
6. 创建触发器和函数

---

## 7. 实施计划

### Phase 1: 数据库迁移（1-2 周）

**任务**:
1. [ ] 移除 SQLite 相关代码
2. [ ] 实现 PostgreSQL 适配器（仅保留 pg-adapter）
3. [ ] 创建数据库初始化脚本
4. [ ] 定义 TimescaleDB 表结构
5. [ ] 创建超表和连续聚合视图
6. [ ] 实现触发器和统计更新逻辑
7. [ ] 配置 Docker Compose 部署
8. [ ] 编写数据库迁移文档

**交付物**:
- 完整的数据库初始化脚本
- Docker Compose 配置
- 数据库设计文档

### Phase 2: API 重构（2-3 周）

**任务**:
1. [ ] 设计新 API 接口
2. [ ] 实现 AnalyticsRouter
3. [ ] 实现时序聚合接口
4. [ ] 实现趋势分析接口
5. [ ] 实现性能对比接口
6. [ ] 实现异常检测接口
7. [ ] 实现统计概览接口
8. [ ] 实现自定义查询接口（高级）
9. [ ] 编写 API 文档（OpenAPI/Swagger）
10. [ ] 编写单元测试

**交付物**:
- 完整的 AnalyticsRouter
- API 文档
- 单元测试

### Phase 3: 前端改造（1-2 周）

**任务**:
1. [ ] 更新 API 客户端（frontend/api.ts）
2. [ ] 重构 StatsPage
3. [ ] 创建 TrendComparisonPage
4. [ ] 创建 PerformanceComparePage
5. [ ] 创建 AnomalyDetectionPage
6. [ ] 创建通用图表组件
7. [ ] 响应式设计优化
8. [ ] 集成测试

**交付物**:
- 更新的前端页面
- 通用图表组件
- 用户使用文档

### Phase 4: 测试与优化（1 周）

**任务**:
1. [ ] 性能测试（大量数据场景）
2. [ ] 压力测试（高并发查询）
3. [ ] 查询优化（索引、缓存）
4. [ ] 错误处理完善
5. [ ] 日志和监控
6. [ ] 用户验收测试

**交付物**:
- 性能测试报告
- 优化建议
- 已知问题和限制

### Phase 5: 文档与发布（0.5 周）

**任务**:
1. [ ] 更新 README
2. [ ] 编写部署文档
3. [ ] 编写 API 使用指南
4. [ ] 编写迁移指南（从旧版本）
5. [ ] 发布新版本

**交付物**:
- 完整的文档
- Release Notes
- Docker 镜像

### 时间线总计: 5.5 - 8.5 周

---

## 8. 技术细节

### 8.1 TimescaleDB 函数扩展

在 Kysely 中使用 TimescaleDB 特定函数：

```typescript
import { sql } from 'kysely';

// time_bucket 函数
const query = db
  .selectFrom('runs')
  .select([
    sql<number>`time_bucket('1 hour', start_time)`.as('bucket'),
    sql<string>`system`.as('system'),
    sql<number>`COUNT(*)`.as('count'),
  ])
  .groupBy([
    sql`time_bucket('1 hour', start_time)`,
    sql`system`
  ])
  .orderBy(sql`bucket`);
```

### 8.2 连续聚合刷新策略

```typescript
// 在初始化脚本中执行
await db.executeQuery(sql`
  SELECT add_continuous_aggregate_policy(
    'run_stats_hourly',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '5 minutes'
  );
`);
```

### 8.3 查询优化

**使用适当的索引**:
- 时间字段（start_time）自动由 Hypertable 处理
- 其他字段（system, model_name）创建 B-tree 索引

**利用连续聚合**:
- 预聚合数据查询直接使用物化视图
- 避免实时计算大量数据

**查询超时控制**:
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.TRACE_DATABASE_URL,
  query_timeout: 30000, // 30 秒
});
```

### 8.4 错误处理

**数据库连接错误**:
```typescript
try {
  const result = await query.execute();
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    throw new Error('Database connection failed');
  }
  throw error;
}
```

**查询超时错误**:
```typescript
try {
  const result = await query.execute();
} catch (error) {
  if (error.code === '57014') { // Query cancelled
    throw new Error('Query timeout exceeded');
  }
  throw error;
}
```

---

## 9. 风险与挑战

### 9.1 数据库迁移风险

**风险**: 切换到 TimescaleDB 后，可能有性能未达预期
**缓解措施**:
- 提前进行性能测试
- 准备降级方案
- 提供查询优化文档

### 9.2 API 兼容性风险

**风险**: 用户依赖旧 API，需要时间迁移
**缓解措施**:
- 保留旧 API，不强制迁移
- 提供清晰的迁移文档
- 提供过渡期

### 9.3 前端开发工作量

**风险**: 前端改造工作量超出预期
**缓解措施**:
- 分阶段发布
- 优先实现核心功能
- 使用现有组件库

### 9.4 部署复杂度

**风险**: Docker Compose 部署可能遇到网络、权限问题
**缓解措施**:
- 提供详细的部署文档
- 提供故障排查指南
- 提供多种部署选项（Docker, 手动安装）

---

## 10. 成功标准

### 10.1 功能完整性

- [ ] 所有核心 API 正常工作
- [ ] 前端所有页面正常展示
- [ ] Docker Compose 一键部署成功

### 10.2 性能指标

- [ ] 时序聚合查询（小时级，1 天数据）< 100ms
- [ ] 趋势分析查询 < 200ms
- [ ] 异常检测查询（1 万条数据）< 500ms
- [ ] 自定义查询（10 万条数据）< 2s

### 10.3 可靠性

- [ ] 数据库连接池正常工作
- [ ] 查询超时机制有效
- [ ] 错误处理完善
- [ ] 日志记录完整

### 10.4 用户体验

- [ ] API 文档清晰易懂
- [ ] 前端界面友好
- [ ] 部署文档完整
- [ ] 示例代码可用

---

## 11. 后续优化方向

### 11.1 高级功能

- **实时仪表板**: 使用 WebSocket 推送实时数据
- **告警系统**: 基于异常检测自动告警（邮件/Slack）
- **数据导出**: CSV/Excel/PDF 导出
- **自定义报表**: 用户创建自定义报表模板

### 11.2 性能优化

- **查询缓存**: Redis 缓存热点查询
- **并行查询**: 多个聚合查询并行执行
- **数据预加载**: 页面加载时预加载常用数据

### 11.3 分析增强

- **AI 驱动分析**: 使用 LLM 自动生成分析报告
- **预测分析**: 时间序列预测（趋势预测）
- **根因分析**: 自动分析异常原因

---

## 12. 参考资料

- [TimescaleDB 官方文档](https://docs.timescale.com/)
- [TimescaleDB 最佳实践](https://docs.timescale.com/timescaledb/latest/best-practices/)
- [PostgreSQL 性能优化](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Kysely 文档](https://kysely.dev/)
- [Chart.js 文档](https://www.chartjs.org/)
- [RESTful API 设计指南](https://restfulapi.net/)

---

## 附录 A: 数据库初始化脚本示例

详见 `sql/init-timescaledb.sql`（待创建）

## 附录 B: API 请求示例

详见 `docs/api-examples.md`（待创建）

## 附录 C: Docker 部署指南

详见 `docs/docker-deployment.md`（待创建）

---

**文档状态**: Draft
**最后更新**: 2026-02-15
**维护者**: Open Smith Team
