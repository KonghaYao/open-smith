# Open Smith Agents 指南

本文档为 AI 助手提供 Open Smith 项目的详细技术参考，帮助理解系统架构、代码结构和开发指南。

## 项目概述

**项目名称**: `@langgraph-js/open-smith`

**版本**: 2.4.0

**描述**: 一个开源的、可自部署的 LangSmith 兼容追踪与可观测平台，为 AI 应用提供运行轨迹（trace）、运行数据（run）、反馈与附件的采集、查询与可视化。

**核心技术栈**:
- **后端**: Node.js + TypeScript + Hono 框架
- **前端**: SolidJS + UnoCSS + Vite
- **数据库**: SQLite（开发环境）/ PostgreSQL（生产环境）
- **主要依赖**: LangChain, LangGraph, Zod, Kysely

## 目录结构

```
open-smith/
├── src/                      # 后端源码
│   ├── app.ts               # Hono 应用入口，路由挂载
│   ├── index.ts             # 服务器启动，优雅关闭处理
│   ├── types.ts             # 前后端共享类型定义
│   ├── api-key-cache.ts     # API Key 缓存管理
│   ├── multipart-processor.ts  # 批量/分段数据处理
│   ├── database/            # 数据库层
│   │   ├── base-database.ts  # 基础数据库，表初始化
│   │   ├── trace-database.ts  # 聚合各仓储
│   │   └── repositories/      # 各表数据访问层
│   ├── adapters/             # 数据库适配器
│   │   ├── pg-adapter.ts     # PostgreSQL 适配器
│   │   ├── better-sqlite-adapter.ts  # SQLite (better-sqlite3)
│   │   └── bun-sqlite-adapter.ts    # SQLite (bun:sqlite)
│   ├── routes/              # 路由层
│   │   ├── trace-router.ts  # 追踪查询
│   │   ├── llm-routes.ts    # LLM 调用
│   │   ├── runs-routes.ts   # 运行数据摄取
│   │   ├── stats-router.ts  # 统计数据
│   │   └── admin-routes.ts  # 系统管理
│   └── utils/               # 工具函数
├── frontend/                # 前端源码
│   ├── main.ts              # 应用入口，路由配置
│   ├── Layout.tsx           # 布局组件
│   ├── api.ts               # API 客户端封装
│   ├── types.ts             # 前端类型定义
│   ├── utils.tsx            # 工具函数
│   ├── components/          # 组件
│   └── pages/               # 页面
│       ├── app/             # 主视图（三栏）
│       ├── LlmRecords/      # 运行记录
│       ├── SystemsPage.tsx  # 系统管理
│       ├── PlayGround/      # 模型测试
│       └── StatsPage.tsx    # 统计可视化
├── attachments/             # 附件存储目录
├── dist/                    # 构建输出
└── sql/                     # 数据库脚本
```

## 核心模块详解

### 1. 数据处理层

#### MultipartProcessor (src/multipart-processor.ts)
批量/分段数据处理器，负责解析 `FormData` 格式的运行数据上报。

**核心方法**:
- `processMultipartData()`: 处理 FormData，支持多种事件类型
  - `post.*`: 创建新运行
  - `patch.*`: 更新运行
  - `feedback.*`: 添加反馈
  - `attachment.*`: 存储附件

**配置文件**:
- `multipart-config.json`: 定义支持的字段和配置
- `multipart-spec.json`: 规范定义
- `multipart-types.ts`: 类型定义和解析器

#### ApiKeyCache (src/api-key-cache.ts)
API Key 缓存管理，减少数据库查询。

**特性**:
- TTL: 5 分钟
- 缓存 `api_key -> systemName` 映射
- 支持缓存失效和重建

### 2. 数据库层

#### TraceDatabase (src/database/trace-database.ts)
聚合所有数据仓储的入口类。

**仓储列表**:
- `systemRepository`: 系统与 API Key 管理
- `runRepository`: 运行记录 CRUD
- `feedbackRepository`: 反馈数据
- `attachmentRepository`: 附件元信息
- `traceRepository`: 追踪数据聚合
- `runStatsRepository`: 统计数据

#### DatabaseAdapter (src/adapters/)
适配器模式，支持多种数据库后端。

**适配器实现**:
1. `PgAdapter`: PostgreSQL，使用 `pg` 库
2. `BetterSqliteAdapter`: SQLite，使用 `better-sqlite3`
3. `BunSQLiteAdapter`: SQLite，使用 `bun:sqlite`

**选择逻辑**:
```typescript
if (process.env.TRACE_DATABASE_URL) {
  return new PgAdapter(connectionString);
} else if (Bun available) {
  return new BunSQLiteAdapter();
} else {
  return new BetterSqliteAdapter();
}
```

### 3. 路由层

#### TraceRouter (src/routes/trace-router.ts)
提供追踪数据的查询接口。

**主要端点**:
- `GET /trace`: 获取所有 traces（支持 `?system=xxx` 过滤）
- `GET /trace/systems`: 获取所有系统列表
- `GET /trace/models`: 获取所有模型名称
- `GET /trace/threads`: 获取所有线程 ID
- `GET /trace/threads/overview`: 获取线程概览
- `GET /trace/traces/search`: 按条件搜索 runs
- `GET /trace/search`: 高级搜索 traces
- `GET /trace/search/:type`: 按类型搜索（traces|runs）
- `GET /trace/system/:system`: 按系统获取 traces
- `GET /trace/thread/:threadId/runs`: 按线程获取 runs
- `GET /trace/:traceId`: 获取 trace 完整信息
- `GET /trace/:traceId/summary`: 获取 trace 摘要
- `GET /trace/:traceId/stats`: 获取 trace 统计

**查询参数**:
- `system`: 系统名称
- `model_name`: 模型名称
- `thread_id`: 线程 ID
- `user_id`: 用户 ID
- `run_type`: 运行类型
- `start_time_after`: 开始时间过滤
- `start_time_before`: 结束时间过滤
- `limit`: 分页限制
- `offset`: 分页偏移

#### LLMRouter (src/routes/llm-routes.ts)
提供大模型调用接口。

**端点**:
- `POST /llm/invoke`: 普通调用
- `POST /llm/stream`: 流式调用（SSE）

**请求格式**:
```typescript
{
  messages: MessagesTemplate[],
  inputs: Record<string, string>,
  model: ModelConfig,
  tools?: ToolDef[],
  output_schema?: JSONSchema
}
```

**依赖**: LangChain `ChatOpenAI`，支持结构化输出和工具绑定。

#### RunsRouter (src/routes/runs-routes.ts)
处理运行数据的批量/分段摄取。

**端点**:
- `POST /runs/batch`: 批量提交
- `POST /runs/multipart`: 分段提交（FormData）

**认证**: 通过 `x-api-key` 请求头识别系统。

#### StatsRouter (src/routes/stats-router.ts)
提供统计数据查询。

**端点**:
- `GET /stats/hourly`: 按小时聚合统计
- `POST /stats/update`: 手动触发统计更新

**统计指标**:
- 运行次数（总计、成功、失败）
- 错误率
- 持续时间（平均、P95、P99）
- Token 消耗（总计、平均）
- 首包时间（平均、P95）
- 独立用户数

#### AdminRouter (src/routes/admin-routes.ts)
系统管理接口，需要 `MASTER_KEY` 认证。

**端点**:
- `GET /admin/systems`: 获取所有系统
- `POST /admin/systems`: 创建新系统
- `PATCH /admin/systems/:id`: 更新系统
- `DELETE /admin/systems/:id`: 删除系统
- `POST /admin/systems/:id/regenerate-key`: 重新生成 API Key
- `GET /admin/systems/:id/stats`: 获取系统统计
- `GET /admin/cache/stats`: 获取缓存统计
- `POST /admin/cache/invalidate`: 失效缓存
- `POST /admin/migrate/existing-runs`: 迁移现有 runs
- `GET /admin/validate/system-references`: 验证系统引用完整性

**认证**:
```http
Authorization: Bearer <MASTER_KEY>
```

### 4. 前端模块

#### 页面组件

**App 主视图** (frontend/pages/app/)
三栏布局：
- 左栏：线程列表
- 中栏：Trace/Run 列表
- 右栏：运行详情

**LlmRecords** (frontend/pages/LlmRecords/)
运行记录查询与过滤页面：
- 多条件过滤（系统、模型、用户、时间范围等）
- 表格展示
- 分页控制
- 右侧详情面板

**SystemsPage** (frontend/pages/SystemsPage.tsx)
系统与 API Key 管理：
- 创建系统
- 查看系统列表
- 重新生成 API Key
- 复制 API Key

**PlayGround** (frontend/pages/PlayGround/)
大模型测试场：
- Prompt 编辑器
- 变量替换
- 模型选择
- 支持结构化输出
- 支持工具调用
- 支持流式输出

**StatsPage** (frontend/pages/StatsPage.tsx)
统计可视化：
- 时间范围选择
- 多指标趋势图
- 按模型性能趋势
- 统计数据表格

#### 组件

- `Table`: 通用表格组件
- `Chart`: Chart.js 封装
- `ModelConfigModal`: 模型配置模态框
- `TemplateEditor`: 模板编辑器
- `GraphStateMessage`: 消息展示

## 核心数据类型

### RunRecord (src/types.ts)
运行记录，包含详细的执行信息。

```typescript
interface BaseRunRecord {
  id: string;
  trace_id?: string;
  name: string;
  run_type?: string;
  system?: string;           // 系统标识
  thread_id?: string;        // 线程 ID
  user_id?: string;          // 用户 ID
  start_time: string;
  end_time: string;
  inputs?: string;           // JSON
  outputs?: string;          // JSON
  events?: string;           // JSON
  error?: string;            // JSON
  extra?: string;            // JSON
  serialized?: string;       // JSON
  total_tokens?: number;    // 总 token 数
  model_name?: string;       // 模型名称
  time_to_first_token?: number;  // 首个 token 时间
  tags?: string;             // JSON 数组
  created_at: string;
  updated_at: string;
}

interface RunRecord extends BaseRunRecord {
  feedback_count: number;
  attachments_count: number;
  feedback: FeedbackRecord[];
  attachments: AttachmentRecord[];
}
```

### TraceOverview (src/types.ts)
追踪概览，包含聚合信息。

```typescript
interface TraceOverview {
  thread_id?: string;
  trace_id: string;
  total_runs: number;
  total_feedback: number;
  total_attachments: number;
  first_run_time: string;
  last_run_time: string;
  run_types: string[];
  systems: string[];
  total_tokens_sum?: number;
  user_id?: string;
}
```

### SystemRecord (src/types.ts)
系统记录，API Key 管理。

```typescript
interface SystemRecord {
  id: string;
  name: string;              // 与 runs.system 关联
  description?: string;
  api_key: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}
```

### RunStatsHourlyRecord (src/types.ts)
小时级统计数据。

```typescript
type RunStatsHourlyRecord = {
  stat_hour: string;
  model_name: string | null;
  system: string | null;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  error_rate: number;
  total_duration_ms: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  total_tokens_sum: number;
  avg_tokens_per_run: number;
  avg_ttft_ms: number;
  p95_ttft_ms: number;
  distinct_users: number;
};
```

## 主要业务流程

### 1. 数据摄取流程

```
Client/Sdk
  ↓ POST /runs/multipart (FormData)
  ↓ x-api-key: system_key
MultipartProcessor
  ↓ 解析 FormData (post.*, patch.*, feedback.*, attachment.*)
TraceDatabase
  ↓ 写入 runs / feedback / attachments 表
本地文件系统
  ↓ 存储附件文件 (./attachments/)
```

### 2. 数据查询流程

```
前端 (ofetch)
  ↓ GET /trace/* 或 /stats/*
  ↓ (可选) Bearer Token (系统管理)
Hono Router
  ↓ 路由分发
TraceDatabase / Repositories
  ↓ 数据查询
数据库
  ← 返回数据
前端
  ↓ 数据可视化
```

### 3. LLM 调用流程

```
Playground
  ↓ POST /llm/invoke 或 /llm/stream
LLMRouter
  ↓ 解析请求 (messages, model, tools, output_schema)
ChatOpenAI (LangChain)
  ↓ 模型调用
OpenAI API
  ← 返回结果 / SSE 流
前端
  ↓ 展示输出
```

## 环境配置

### 必需环境变量
- `MASTER_KEY`: 管理员密钥，用于系统管理接口

### 可选环境变量
- `TRACE_DATABASE_URL`: PostgreSQL 连接字符串（不配置则使用 SQLite）

示例:
```sh
MASTER_KEY=your-secret-key
TRACE_DATABASE_URL=postgresql://user:pass@localhost:5432/open_smith
```

### 端口配置
- 默认端口: `7765`
- 前端开发代理: `8367`

## 开发指南

### 启动开发环境

**后端**:
```bash
pnpm dev
# 运行在 http://localhost:7765
```

**前端**:
```bash
pnpm dev:fe
# 运行在 http://localhost:8367
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

LangGraph/LangChain 项目配置：
```sh
LANGSMITH_ENDPOINT="http://localhost:7765"
LANGSMITH_API_KEY="lsv2_ts"  # 在 open-smith 中创建的 API Key
```

### GUI 访问
```
http://localhost:7765/ui/index.html
```

## 数据库表结构

### systems
系统与 API Key 管理。

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| name | string | 系统名称（唯一） |
| description | string | 描述 |
| api_key | string | API 密钥（唯一） |
| status | enum | 状态: active/inactive |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### runs
运行记录，核心数据表。

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| trace_id | string | 追踪 ID |
| name | string | 运行名称 |
| run_type | string | 类型: llm/chain/tool/retriever |
| system | string | 系统名称 |
| thread_id | string | 线程 ID |
| user_id | string | 用户 ID |
| start_time | datetime | 开始时间 |
| end_time | datetime | 结束时间 |
| inputs | json | 输入数据 |
| outputs | json | 输出数据 |
| events | json | 事件数据 |
| error | json | 错误信息 |
| extra | json | 额外数据 |
| serialized | json | 序列化数据 |
| total_tokens | int | 总 token 数 |
| model_name | string | 模型名称 |
| time_to_first_token | int | 首包时间 |
| tags | json | 标签 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### feedback
运行反馈。

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| trace_id | string | 追踪 ID |
| run_id | string | 运行 ID |
| feedback_id | string | 反馈 ID |
| score | decimal | 评分 |
| comment | string | 评论 |
| metadata | json | 元数据 |
| created_at | datetime | 创建时间 |

### attachments
附件记录。

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 主键 |
| run_id | string | 运行 ID |
| filename | string | 文件名 |
| content_type | string | MIME 类型 |
| file_size | int | 文件大小 |
| storage_path | string | 存储路径 |
| created_at | datetime | 创建时间 |

### run_stats_hourly
小时级统计数据。

| 字段 | 类型 | 描述 |
|------|------|------|
| stat_hour | datetime | 统计小时 |
| model_name | string | 模型名称 |
| system | string | 系统名称 |
| total_runs | int | 总运行次数 |
| successful_runs | int | 成功次数 |
| failed_runs | int | 失败次数 |
| error_rate | decimal | 错误率 |
| total_duration_ms | int | 总持续时间 |
| avg_duration_ms | int | 平均持续时间 |
| p95_duration_ms | int | P95 持续时间 |
| p99_duration_ms | int | P99 持续时间 |
| total_tokens_sum | int | 总 token 数 |
| avg_tokens_per_run | int | 平均 token 数 |
| avg_ttft_ms | int | 平均首包时间 |
| p95_ttft_ms | int | P95 首包时间 |
| distinct_users | int | 独立用户数 |

## API 端点速查

### 追踪查询 (`/trace`)
- `GET /trace` - 所有 traces
- `GET /trace/systems` - 系统列表
- `GET /trace/models` - 模型列表
- `GET /trace/threads` - 线程列表
- `GET /trace/threads/overview` - 线程概览
- `GET /trace/traces/search` - 搜索 runs
- `GET /trace/search` - 高级搜索 traces
- `GET /trace/search/:type` - 按类型搜索
- `GET /trace/system/:system` - 按系统
- `GET /trace/thread/:threadId/runs` - 按线程
- `GET /trace/:traceId` - 详情
- `GET /trace/:traceId/summary` - 摘要
- `GET /trace/:traceId/stats` - 统计

### 运行数据 (`/runs`)
- `POST /runs/batch` - 批量提交
- `POST /runs/multipart` - 分段提交

### 统计 (`/stats`)
- `GET /stats/hourly` - 小时统计
- `POST /stats/update` - 更新统计

### 系统管理 (`/admin`) [需 MASTER_KEY]
- `GET /admin/systems` - 系统列表
- `POST /admin/systems` - 创建系统
- `PATCH /admin/systems/:id` - 更新系统
- `DELETE /admin/systems/:id` - 删除系统
- `POST /admin/systems/:id/regenerate-key` - 重置 Key
- `GET /admin/systems/:id/stats` - 系统统计
- `GET /admin/cache/stats` - 缓存统计
- `POST /admin/cache/invalidate` - 失效缓存
- `POST /admin/migrate/existing-runs` - 迁移数据
- `GET /admin/validate/system-references` - 验证引用

### LLM (`/llm`)
- `POST /llm/invoke` - 普通调用
- `POST /llm/stream` - 流式调用

### 信息
- `GET /info` - 服务信息和端点列表

## 注意事项

### 安全性
1. **MASTER_KEY**: 永远不要暴露 `MASTER_KEY`，它授予完全的管理权限
2. **API Key**: 每个 API Key 只能访问对应系统的数据
3. **输入验证**: 使用 Zod schema 进行请求验证
4. **SQL 注入**: 使用 Kysely 参数化查询，防止注入

### 性能优化
1. **缓存**: ApiKeyCache 减少数据库查询（5分钟 TTL）
2. **分页**: 所有列表查询都支持 `limit` 和 `offset`
3. **索引**: 数据库表已建立适当索引
4. **批量操作**: 使用 `/runs/multipart` 支持批量数据上传

### 错误处理
1. **优雅关闭**: 支持 SIGINT 和 SIGTERM 信号
2. **错误日志**: 使用 Hono logger 记录请求
3. **Curl 输出**: 404 请求会输出 curl 命令便于调试

### 数据一致性
1. **外键约束**: 确保 runs.system 引用有效的 systems.name
2. **迁移工具**: `/admin/migrate/existing-runs` 可迁移历史数据
3. **验证工具**: `/admin/validate/system-references` 验证引用完整性

## 常见任务

### 创建新系统
```bash
curl -X POST http://localhost:7765/admin/systems \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-system", "description": "My AI App"}'
```

### 查看系统统计
```bash
curl -X GET http://localhost:7765/admin/systems/{id}/stats \
  -H "Authorization: Bearer $MASTER_KEY"
```

### 查询运行记录
```bash
curl -X GET "http://localhost:7765/trace/traces/search?system=my-system&limit=10&offset=0"
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

## 扩展开发

### 添加新的路由
在 `src/routes/` 创建新路由文件，然后在 `src/app.ts` 挂载：

```typescript
import { createMyRouter } from './routes/my-router.js';
app.route('/my-route', createMyRouter(db));
```

### 添加新的数据库表
1. 在 `src/database/base-database.ts` 的 `init()` 方法添加表创建逻辑
2. 在 `src/database/repositories/` 创建对应的 repository
3. 在 `TraceDatabase` 中添加该 repository

### 添加新的前端页面
1. 在 `frontend/pages/` 创建页面组件
2. 在 `frontend/main.ts` 添加路由
3. 如需导航，在 `frontend/Layout.tsx` 添加链接

## 相关资源

- **LangSmith 官方文档**: https://docs.smith.langchain.com/
- **LangChain 文档**: https://js.langchain.com/
- **Hono 文档**: https://hono.dev/
- **SolidJS 文档**: https://www.solidjs.com/
- **Kysely 文档**: https://kysely.dev/

## 许可证

Apache-2.0
