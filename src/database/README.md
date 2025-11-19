# 数据库重构：使用 Kysely

本项目已从自定义数据库适配器重构为使用 [Kysely](https://kysely.dev/) 查询构建器。

## 主要改动

### 1. Schema 定义

新增 `schema.ts`，定义了完整的数据库表结构类型：

```typescript
import type { Database } from "./database/schema.js";
```

### 2. Dialect 适配器

新增 `kysely-dialects.ts`，提供多种数据库适配器：

-   **Bun SQLite**: `createBunSqliteKysely()` - Bun 运行时的 SQLite
-   **Better-SQLite3**: `createBetterSqlite3Kysely()` - Node.js 环境的 SQLite
-   **PostgreSQL**: `createPostgresKysely()` - PostgreSQL 数据库
-   **自动检测**: `createKyselyInstance()` - 根据环境自动选择

### 3. 使用示例

```typescript
// 创建数据库实例
import { TraceDatabase, createKyselyInstance } from "./database.js";

// 方式 1: 自动检测环境
const kysely = createKyselyInstance();

// 方式 2: 手动指定 Bun SQLite
const kysely = createBunSqliteKysely("./.langgraph_api/trace.db");

// 方式 3: PostgreSQL
const kysely = createPostgresKysely({
    connectionString: "postgresql://user:password@localhost:5432/db",
});

// 初始化数据库
const db = new TraceDatabase(kysely);
await db.init();

// 使用数据库
const systems = await db.getAllSystemRecords();
```

### 4. 迁移说明

**删除的文件：**

-   `src/database/interfaces.ts` - 旧的适配器接口
-   `src/adapters/bun-sqlite-adapter.ts` - 旧的 Bun SQLite 适配器
-   `src/adapters/pg-adapter.ts` - 旧的 PostgreSQL 适配器
-   `src/adapters/better-sqlite-adapter.ts` - 旧的 Better-SQLite3 适配器

**新增的文件：**

-   `src/database/schema.ts` - 数据库表结构定义
-   `src/database/kysely-dialects.ts` - Kysely dialect 适配器

**修改的文件：**

-   `src/database/base-database.ts` - 使用 Kysely 而非自定义适配器
-   `src/database/repositories/*.ts` - 所有 repository 都重构为使用 Kysely
-   `src/database/index.ts` - 更新导出
-   `src/app.ts` - 更新数据库初始化代码

## 优势

1. **类型安全**: Kysely 提供完整的 TypeScript 类型推导
2. **跨数据库**: 统一的 API，轻松切换不同数据库
3. **查询构建**: 使用链式 API 构建复杂查询，更加清晰
4. **维护性**: 减少自定义代码，使用成熟的库
5. **性能**: Kysely 针对性能进行了优化

## Repository 示例

```typescript
// 旧的方式（已废弃）
const stmt = await this.adapter.prepare(
    `SELECT * FROM systems WHERE id = ${this.adapter.getPlaceholder(1)}`,
);
const result = await stmt.get([id]);

// 新的方式（使用 Kysely）
const result = await this.db
    .selectFrom("systems")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
```

## 环境变量

保持与之前相同：

-   `TRACE_DATABASE_URL`: PostgreSQL 连接字符串（可选）
-   未设置时自动使用 SQLite（根据运行环境选择 Bun 或 Better-SQLite3）
