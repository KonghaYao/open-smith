# 数据库模块重构

此模块将原来的单一 `TraceDatabase` 类拆分为多个职责单一的模块，提高代码的可维护性和可扩展性。

## 文件结构

```
src/database/
├── interfaces.ts           # 数据库适配器接口定义
├── base-database.ts        # 基础数据库类（表初始化、事务等）
├── utils.ts               # 工具函数（数据提取、格式化等）
├── repositories/          # 各功能仓库类
│   ├── system-repository.ts    # 系统管理相关操作
│   ├── run-repository.ts       # Run 记录相关操作
│   ├── feedback-repository.ts  # 反馈相关操作
│   ├── attachment-repository.ts # 附件相关操作
│   └── trace-repository.ts     # Trace 相关操作
├── index.ts               # 主入口文件，组合所有功能
└── README.md              # 本文档
```

## 主要改进

1. **职责分离**: 将不同的数据库操作分离到专门的仓库类中
2. **代码复用**: 提取公共工具函数到 `utils.ts`
3. **接口抽象**: 将数据库适配器接口独立定义
4. **易于维护**: 每个文件职责单一，便于后续维护和扩展
5. **向后兼容**: 保持原有 API 不变，现有代码无需修改

## 使用方法

```typescript
import { TraceDatabase } from "./database.js";

// 原有使用方式保持不变
const db = new TraceDatabase(adapter);
await db.init();

// 所有原有方法都可以正常使用
const run = await db.createRun(runData);
const traces = await db.getAllTraces();
```

## 各模块说明

### `interfaces.ts`

定义了数据库适配器的标准接口，包括：

-   `DatabaseAdapter`: 数据库适配器接口
-   `PreparedStatement`: 预处理语句接口

### `base-database.ts`

包含基础数据库功能：

-   表结构初始化
-   索引创建
-   事务管理
-   数据库连接关闭

### `utils.ts`

提供工具函数：

-   时间戳格式化
-   API 密钥生成
-   从数据中提取特定字段（tokens、model_name 等）

### `repositories/`

各功能模块的具体实现：

-   **SystemRepository**: 系统的增删改查、统计、迁移等
-   **RunRepository**: Run 记录的增删改查、条件查询等
-   **FeedbackRepository**: 反馈的创建和查询
-   **AttachmentRepository**: 附件的创建和查询
-   **TraceRepository**: Trace 的查询、统计、条件筛选等

### `index.ts`

主入口文件，将所有仓库组合成完整的 `TraceDatabase` 类，保持向后兼容。

## 扩展指南

如需添加新功能：

1. 如果是新的数据表，在对应目录创建新的仓库类
2. 在 `base-database.ts` 中添加表结构定义
3. 在 `index.ts` 中添加对应的方法代理
4. 如果有公共逻辑，添加到 `utils.ts`

这样的结构使得代码更容易理解、测试和维护。
