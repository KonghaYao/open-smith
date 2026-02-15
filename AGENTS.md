# Open Smith AI 助手指南

> **项目**: `@langgraph-js/open-smith`
> **版本**: 2.4.0
> **描述**: 开源的 LangSmith 兼容追踪与可观测平台

---

## 项目概述

开源的 LangSmith 兼容平台，提供 AI 应用的运行轨迹、数据采集、查询与可视化。

**技术栈**:
- **后端**: Node.js + TypeScript + Hono
- **前端**: SolidJS + UnoCSS + Vite
- **数据库**: SQLite（开发）/ TimescaleDB（生产）
- **核心依赖**: LangChain, LangGraph, Zod, Kysely

---

## 目录结构

```
open-smith/
├── src/                         # 后端源码
│   ├── app.ts                  # Hono 应用入口
│   ├── index.ts                # 服务器启动
│   ├── types.ts                # 共享类型定义
│   ├── api-key-cache.ts        # API Key 缓存
│   ├── multipart-processor.ts  # 批量数据处理
│   ├── database/               # 数据库层
│   │   ├── base-database.ts    # 基础初始化
│   │   ├── trace-database.ts   # 仓储聚合
│   │   └── repositories/       # 各表数据访问
│   ├── adapters/               # 数据库适配器
│   │   ├── pg-adapter.ts       # PostgreSQL/TimescaleDB
│   │   ├── better-sqlite-adapter.ts  # SQLite
│   │   └── bun-sqlite-adapter.ts    # SQLite (Bun)
│   ├── routes/                 # 路由层
│   │   ├── trace-router.ts    # 追踪查询
│   │   ├── llm-routes.ts       # LLM 调用
│   │   ├── runs-routes.ts      # 运行数据摄取
│   │   ├── stats-router.ts     # 统计数据
│   │   └── admin-routes.ts     # 系统管理
│   └── utils/                  # 工具函数
├── frontend/                    # 前端源码
│   ├── main.ts                 # 应用入口
│   ├── api.ts                  # API 客户端
│   ├── components/             # 组件
│   └── pages/                  # 页面
│       ├── app/                # 主视图（三栏）
│       ├── LlmRecords/         # 运行记录
│       ├── SystemsPage.tsx     # 系统管理
│       ├── PlayGround/         # 模型测试
│       └── StatsPage.tsx       # 统计可视化
├── attachments/                # 附件存储
├── sql/                        # 数据库脚本
│   └── init-timescaledb.sql    # TimescaleDB 初始化
└── specs/                      # 技术文档
    └── timescaledb-implementation.md  # 数据库实现详情
```

---

## 核心模块

### 1. 数据处理层

**MultipartProcessor** (`src/multipart-processor.ts`)
- 解析 FormData 格式的批量运行数据
- 支持 `post.*`（创建）、`patch.*`（更新）、`feedback.*`（反馈）、`attachment.*`（附件）

**ApiKeyCache** (`src/api-key-cache.ts`)
- API Key 缓存，TTL 5 分钟
- 缓存 `api_key -> systemName` 映射

### 2. 数据库层

**BaseDatabase** (`src/database/base-database.ts`)
- 读取 `sql/init-timescaledb.sql` 初始化数据库
- 验证表存在性，启用实时聚合

**TraceDatabase** (`src/database/trace-database.ts`)
- 聚合所有仓储：system, run, feedback, attachment, trace, runStats

**DatabaseAdapter** (`src/adapters/`)
- `PgAdapter`: PostgreSQL/TimescaleDB（生产环境）
- `BetterSqliteAdapter`: SQLite（开发环境）
- `BunSQLiteAdapter`: SQLite (Bun 运行时)

### 3. 路由层

#### TraceRouter (`/trace`)
追踪数据查询端点：
- `GET /trace` - 所有 traces（支持 `?system=xxx` 过滤）
- `GET /trace/systems` - 系统列表
- `GET /trace/models` - 模型列表
- `GET /trace/threads` - 线程列表
- `GET /trace/traces/search` - 按条件搜索 runs
- `GET /trace/:traceId` - trace 详情
- `GET /trace/:traceId/summary` - trace 摘要
- `GET /trace/:traceId/stats` - trace 统计

**查询参数**: system, model_name, thread_id, user_id, run_type, start_time_after, start_time_before, limit, offset

#### LLMRouter (`/llm`)
- `POST /llm/invoke` - 普通调用
- `POST /llm/stream` - 流式调用（SSE）

**依赖**: LangChain `ChatOpenAI`

#### RunsRouter (`/runs`)
- `POST /runs/batch` - 批量提交
- `POST /runs/multipart` - 分段提交（FormData）

**认证**: `x-api-key` 请求头

#### StatsRouter (`/stats`)
- `GET /stats/hourly` - 小时级统计（从 TimescaleDB 连续聚合）
- `POST /stats/update` - 手动触发统计更新

#### AdminRouter (`/admin`) [需 MASTER_KEY]
- `GET /admin/systems` - 系统列表
- `POST /admin/systems` - 创建系统
- `PATCH /admin/systems/:id` - 更新系统
- `DELETE /admin/systems/:id` - 删除系统
- `POST /admin/systems/:id/regenerate-key` - 重新生成 API Key
- `GET /admin/systems/:id/stats` - 系统统计
- `POST /admin/cache/invalidate` - 失效缓存

**认证**: `Authorization: Bearer <MASTER_KEY>`

### 4. 前端模块

**App 主视图** (`frontend/pages/app/`): 三栏布局（线程列表、Trace/Run 列表、运行详情）

**LlmRecords**: 运行记录查询与过滤

**SystemsPage**: 系统与 API Key 管理

**PlayGround**: 大模型测试场（支持结构化输出、工具调用、流式输出）

**StatsPage**: 统计可视化（时间范围选择、多指标趋势图）

---

## 核心数据类型

### RunRecord
```typescript
interface BaseRunRecord {
  id: string;
  trace_id?: string;
  name: string;
  run_type?: string;        // llm/chain/tool/retriever
  system?: string;
  thread_id?: string;
  user_id?: string;
  start_time: string;
  end_time: string;
  inputs?: string;          // JSON
  outputs?: string;         // JSON
  events?: string;          // JSON
  error?: string;           // JSON
  extra?: string;           // JSON
  serialized?: string;      // JSON
  total_tokens?: number;
  model_name?: string;
  time_to_first_token?: number;
  tags?: string;            // JSON array
  created_at: string;
  updated_at: string;
}
```

### TraceOverview
```typescript
interface TraceOverview {
  trace_id: string;
  total_runs: number;
  total_feedback: number;
  total_attachments: number;
  first_run_time: string;
  last_run_time: string;
  run_types: string[];
  systems: string[];
  total_tokens_sum?: number;
}
```

### SystemRecord
```typescript
interface SystemRecord {
  id: string;
  name: string;             // 与 runs.system 关联
  description?: string;
  api_key: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}
```

---

## 数据库

### 数据库选择

| 环境 | 数据库 | 说明 |
|------|--------|------|
| 开发 | SQLite | `better-sqlite3` 或 `bun:sqlite` |
| 生产 | TimescaleDB | PostgreSQL 扩展，时序数据优化 |

### TimescaleDB 实现

**详细文档**: `specs/timescaledb-implementation.md`

**核心特性**:
- `runs` 表为 hypertable，按 `start_time` 分区
- 5 个连续聚合视图：15min, hourly, daily, weekly, monthly
- 只统计 `run_type = 'llm'` 的记录
- 无中间表，直接在 `runs` 表上聚合
- 自动刷新策略 + 实时聚合

**主要表**:
- `systems`: 系统与 API Key 管理
- `runs`: 运行记录（hypertable）
- `feedback`: 运行反馈
- `attachments`: 附件元数据

**连续聚合视图**:
- `run_stats_hourly`: 小时级统计
- `run_stats_daily`: 天级统计
- `run_stats_weekly`: 周级统计
- `run_stats_monthly`: 月级统计

**关键索引**:
- `idx_runs_start_time`: 时间查询优化
- `idx_runs_system_model`: 系统+模型组合查询
- `idx_runs_run_type`: 运行类型过滤

---

## 环境配置

### 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `MASTER_KEY` | ✅ | 管理员密钥 |
| `TRACE_DATABASE_URL` | ❌ | PostgreSQL/TimescaleDB 连接字符串（不配置则使用 SQLite） |

### 示例配置
```sh
MASTER_KEY=your-secret-key
TRACE_DATABASE_URL=postgresql://user:pass@localhost:5432/open_smith
```

### 端口
- 后端默认: `7765`
- 前端开发代理: `8367`

---

## 开发指南

### 启动开发环境

**后端**:
```bash
pnpm dev
# http://localhost:7765
```

**前端**:
```bash
pnpm dev:fe
# http://localhost:8367
# API 代理到 http://localhost:7765
```

### 构建
```bash
pnpm build
# 编译后端 + 构建前端到 dist/public
```

### 生产启动
```bash
pnpm start
# 运行 dist/index.js
# 前端通过 /ui/* 提供服务
```

### 客户端配置

LangGraph/LangChain 项目：
```sh
LANGSMITH_ENDPOINT="http://localhost:7765"
LANGSMITH_API_KEY="lsv2_ts"  # 在 open-smith 中创建的 API Key
```

### GUI 访问
```
http://localhost:7765/ui/index.html
```

---

## 常见任务

### 创建新系统
```bash
curl -X POST http://localhost:7765/admin/systems \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-system", "description": "My AI App"}'
```

### 查询运行记录
```bash
curl -X GET "http://localhost:7765/trace/traces/search?system=my-system&limit=10"
```

### 调用 LLM
```bash
curl -X POST http://localhost:7765/llm/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "human", "content": "Hello"}],
    "model": {
      "model_name": "gpt-4",
      "provider_key": "your-key",
      "provider_url": "https://api.openai.com/v1"
    }
  }'
```

### 查看统计数据
```bash
curl -X GET "http://localhost:7765/stats/hourly?start_time=$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ)"
```

---

## API 端点速查

| 路由 | 方法 | 端点 | 认证 |
|------|------|------|------|
| `/trace` | GET | traces, systems, models, threads | - |
| `/trace/:traceId` | GET | trace 详情、摘要、统计 | - |
| `/runs` | POST | 批量/分段提交 | x-api-key |
| `/stats` | GET/POST | 统计数据查询/更新 | - |
| `/llm` | POST | LLM 调用（invoke/stream） | - |
| `/admin` | GET/POST/PATCH/DELETE | 系统管理 | Bearer Token |

---

## 扩展开发

### 添加新路由
```typescript
// src/routes/my-router.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';

export function createMyRouter(db: Kysely<Database>) {
  const router = new Hono();

  router.get('/', async (c) => {
    // 实现
  });

  return router;
}

// src/app.ts
import { createMyRouter } from './routes/my-router.js';
app.route('/my-route', createMyRouter(db));
```

### 添加新数据库表
1. 在 `sql/init-timescaledb.sql` 添加表创建 SQL
2. 在 `src/database/schema.ts` 添加 TypeScript 类型
3. 在 `src/database/repositories/` 创建 repository

### 添加新前端页面
1. 在 `frontend/pages/` 创建页面组件
2. 在 `frontend/main.ts` 添加路由

---

## 重要提示

### 安全性
- ⚠️ **MASTER_KEY**: 永远不要暴露
- ✅ **API Key**: 每个 Key 只能访问对应系统的数据
- ✅ **输入验证**: 使用 Zod schema 验证请求
- ✅ **SQL 注入**: 使用 Kysely 参数化查询

### 性能优化
- **缓存**: ApiKeyCache 减少 DB 查询（5 分钟 TTL）
- **分页**: 所有列表查询支持 `limit` 和 `offset`
- **索引**: 数据库表已建立适当索引
- **批量操作**: 使用 `/runs/multipart` 批量上传

### TimescaleDB 运维
- **版本要求**: PostgreSQL ≥ 14, TimescaleDB ≥ 2.10
- **刷新状态**: `SELECT * FROM timescaledb_information.continuous_aggregate_stats`
- **手动刷新**: `CALL refresh_continuous_aggregate('run_stats_hourly', ...)`
- **详细文档**: `specs/timescaledb-implementation.md`

---

## 相关资源

- **LangSmith 文档**: https://docs.smith.langchain.com/
- **LangChain 文档**: https://js.langchain.com/
- **Hono 文档**: https://hono.dev/
- **SolidJS 文档**: https://www.solidjs.com/
- **Kysely 文档**: https://kysely.dev/
- **TimescaleDB 文档**: https://docs.timescale.com/

## 许可证

Apache-2.0
