# Open Smith 前端设计文档

## 概述

本文档描述基于 TimescaleDB 视图结构的前端页面重新设计，充分利用多粒度连续聚合视图的能力。

---

## 1. 性能仪表板 (PerformanceDashboard)

**路由**: `/dashboard`

**设计目标**: 提供实时系统健康监控和性能指标可视化

### 核心功能

#### 1.1 健康度评分
- 基于成功率和性能指标的加权评分
- 三级健康状态：绿色(90+) / 黄色(70-89) / 红色(<70)
- 带有趋势指示器（上升/下降/稳定）

#### 1.2 实时关键指标卡片
| 指标 | 数据源 | 单位 |
|------|--------|------|
| 总运行次数 | `total_runs` | 次 |
| 成功率 | `successful_runs / total_runs` | % |
| 平均延迟 | `avg_duration_ms` | 秒 |
| P95 延迟 | `p95_duration_ms` | 秒 |
| 独立用户 | `distinct_users` | 人 |
| Token 消耗 | `total_tokens_sum` | k |

#### 1.3 实时趋势图表
- **多粒度支持**: 15分钟/1小时/3小时/12小时/1天/7天
- **粒度自动选择**:
  - 15分钟范围 → `5min` 粒度
  - 1小时范围 → `15min` 粒度
  - 3小时范围 → `30min` 粒度
  - 12小时+范围 → `1h` 粒度

- **指标展示**:
  - 运行次数（左Y轴）
  - 错误率%（右Y轴）
  - 平均延迟（秒）
  - P95 延迟（秒）

#### 1.4 P95/P99 延迟分布图
- 响应延迟 P95/P99 趋势
- 首包时间 P95 趋势
- 双Y轴设计，独立缩放

#### 1.5 性能异常检测
自动检测并显示：
- **高错误率警告**: 错误率 > 10%
- **高延迟警告**: 平均延迟 > 5秒

### 技术实现
- 使用 `run_stats_15min` / `run_stats_hourly` 视图
- 实时数据刷新（手动刷新按钮）
- Chart.js 折线图 + 渐变填充

---

## 2. 成本分析 (CostAnalysis)

**路由**: `/cost`

**设计目标**: 追踪和优化 LLM 使用成本

### 核心功能

#### 2.1 成本概览卡片
| 指标 | 说明 |
|------|------|
| 总成本 | 选择时间范围内的总花费 |
| 日均成本 | 平均每日花费 |
| 预计月度成本 | 基于日均成本预测30天 |
| 活跃模型数 | 当前使用的不同模型数量 |

#### 2.2 成本趋势图
- 折线图显示每日成本变化
- 时间范围：1天/3天/7天/30天/90天
- 基于日级粒度聚合

#### 2.3 按模型成本分布
- 环形图（Doughnut Chart）
- 支持的模型定价配置：
  ```typescript
  const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    "claude-3-opus": { input: 15, output: 15 },
    "claude-3-sonnet": { input: 3, output: 15 },
    "claude-3-haiku": { input: 0.25, output: 1.25 },
    "claude-3.5-sonnet": { input: 3, output: 15 },
  };
  ```

#### 2.4 按系统成本排行表
| 列 | 说明 |
|----|------|
| 系统名称 | 系统标识 |
| 成本 (USD) | 总花费 |
| 运行次数 | 系统的总调用次数 |
| 平均成本/次 | 单次调用平均成本 |

### 技术实现
- 使用 `run_stats_daily` / `run_stats_weekly` / `run_stats_monthly` 视图
- Token → 成本转换算法
- 按 model_name 和 system 维度聚合

---

## 3. 统计分析页面优化 (StatsPage)

**路由**: `/stats`

### 改进点

#### 3.1 粒度自适应
根据时间范围自动选择合适的粒度：
- 最近1-3小时 → `15min` 粒度
- 最近12小时 → `30min` 粒度
- 最近1-3天 → `1h` 粒度
- 最近7-30天 → `1d` 粒度
- 最近30天+ → `1w` 粒度

#### 3.2 多指标趋势分析
- 支持 12+ 指标同时展示
- 自动为不同量级指标分配独立Y轴
- 多色线条区分

#### 3.3 按模型性能趋势
- 单指标多模型对比
- 颜色区分不同模型
- 支持所有统计指标

### 现有功能保持
- 时间范围快速选择（1h/3h/12h/1d/3d/7d/30d）
- 系统和模型过滤
- 数据详情表格

---

## 4. 数据概览页面优化 (LlmRecords)

**路由**: `/llm-records`

### 改进点

#### 4.1 性能热力图（建议添加）
为表格行添加性能状态指示：
- 🟢 优秀：延迟 < 1秒
- 🟡 良好：延迟 1-3秒
- 🔴 较差：延迟 > 3秒

#### 4.2 关键指标高亮
- 高延迟记录（P95+）
- 高 Token 消耗记录（前10%）
- 失败记录（error 不为空）

#### 4.3 列配置增强
现有列保持不变，建议添加：
- **成本估算列**: 基于 Token 消耗计算成本
- **性能评级列**: 基于延迟的分级

### 现有功能保持
- 多条件过滤
- 分页控制
- 详情面板
- 时间范围选择

---

## 5. API 类型扩展

### 新增类型定义 (已存在于 api.ts)

```typescript
export interface TimeseriesQuery {
    dimension?: "system" | "model_name" | "run_type" | "user_id";
    metrics: string[];
    granularity: "5min" | "15min" | "30min" | "1h" | "1d" | "1w" | "1m";
    start_time?: string;
    end_time?: string;
    filters?: {
        system?: string[];
        model_name?: string[];
        run_type?: string[];
        user_id?: string;
    };
    limit?: number;
    offset?: number;
}

export interface TimeseriesResponse {
    success: boolean;
    data: Array<{
        time: string;
        dimensions?: Record<string, string>;
        metrics: Record<string, number | null>;
    }>;
    meta: {
        total: number;
        limit: number;
        offset: number;
    };
}
```

### 支持的指标

| 指标 | 说明 | 单位 |
|------|------|------|
| `total_runs` | 总运行次数 | 次数 |
| `successful_runs` | 成功次数 | 次数 |
| `failed_runs` | 失败次数 | 次数 |
| `error_rate` | 错误率 | 比例 |
| `avg_duration_ms` | 平均延迟 | 毫秒 |
| `p95_duration_ms` | P95 延迟 | 毫秒 |
| `p99_duration_ms` | P99 延迟 | 毫秒 |
| `total_tokens_sum` | 总 Token 数 | 个数 |
| `avg_tokens_per_run` | 平均 Token/次 | 个数 |
| `avg_ttft_ms` | 平均首包时间 | 毫秒 |
| `p95_ttft_ms` | P95 首包时间 | 毫秒 |
| `distinct_users` | 独立用户数 | 人 |

---

## 6. 视图与页面映射

### 连续聚合视图使用映射

| 前端页面 | 使用视图 | 粒度 | 用途 |
|---------|---------|------|------|
| PerformanceDashboard | `run_stats_15min` | 15分钟 | 实时监控（15分钟范围） |
| PerformanceDashboard | `run_stats_hourly` | 1小时 | 中期趋势（1-12小时范围） |
| StatsPage | `run_stats_hourly` | 1小时 | 日常统计 |
| StatsPage | `run_stats_daily` | 1天 | 长期统计（7-30天） |
| StatsPage | `run_stats_weekly` | 1周 | 长期统计（30天+） |
| CostAnalysis | `run_stats_daily` | 1天 | 成本分析 |
| CostAnalysis | `run_stats_weekly` | 1周 | 成本趋势（30-90天） |
| CostAnalysis | `run_stats_monthly` | 1月 | 成本趋势（90天+） |
| LlmRecords | `runs` 表 | - | 原始数据查询 |

### 粒度选择策略

```typescript
const getGranularityByTimeRange = (range: string): "5min" | "15min" | "30min" | "1h" | "1d" | "1w" | "1m" => {
    switch (range) {
        case "15m": return "5min";    // PerformanceDashboard
        case "1h": return "15min";    // PerformanceDashboard
        case "3h": return "30min";    // PerformanceDashboard
        case "12h": return "1h";      // PerformanceDashboard
        case "1d": return "1h";       // StatsPage / CostAnalysis
        case "3d": return "1h";       // StatsPage / CostAnalysis
        case "7d": return "1d";       // StatsPage / CostAnalysis
        case "30d": return "1d";      // StatsPage / CostAnalysis
        case "90d": return "1w";      // CostAnalysis
        default: return "1h";
    }
};
```

---

## 7. 路由更新

### 新增路由

```typescript
// frontend/main.ts
Route({
    path: "/dashboard",
    component: lazy(() =>
        import("./pages/PerformanceDashboard.tsx").then((res) => {
            return { default: res.default };
        })
    ),
}),
Route({
    path: "/cost",
    component: lazy(() =>
        import("./pages/CostAnalysis.tsx").then((res) => {
            return { default: res.default };
        })
    ),
}),
```

### 导航菜单更新

```typescript
// frontend/Layout.tsx
const menuItems = [
    // ... 现有菜单项
    {
        href: "#/dashboard",
        title: "性能仪表板",
        icon: <LayoutDashboard />,
    },
    {
        href: "#/cost",
        title: "成本分析",
        icon: <DollarSign />,
    },
    // ... 其他菜单项
];
```

---

## 8. 技术栈

- **框架**: SolidJS + TypeScript
- **路由**: @solidjs/router
- **图表**: Chart.js
- **样式**: UnoCSS + Tailwind CSS
- **HTTP客户端**: ofetch
- **图标**: lucide-solid

---

## 9. 后续改进建议

### 9.1 性能优化
- [ ] 实现数据缓存策略
- [ ] 虚拟滚动处理大数据量
- [ ] WebSocket 实时数据推送

### 9.2 功能增强
- [ ] 支持自定义时间范围选择器
- [ ] 导出图表为图片/PDF
- [ ] 数据对比功能（多时期对比）
- [ ] 预算告警设置

### 9.3 用户体验
- [ ] 暗色模式支持
- [ ] 响应式设计优化
- [ ] 加载骨架屏
- [ ] 空状态设计

### 9.4 数据分析
- [ ] 趋势预测（基于历史数据）
- [ ] 智能异常检测（Z-Score, IQR 等算法）
- [ ] 模型性能基准测试
- [ ] 成本优化建议

---

## 10. 文件清单

### 新增文件
- `frontend/pages/PerformanceDashboard.tsx` - 性能仪表板页面
- `frontend/pages/CostAnalysis.tsx` - 成本分析页面

### 修改文件
- `frontend/main.ts` - 添加新路由
- `frontend/Layout.tsx` - 添加导航菜单项
- `frontend/DESIGN.md` - 本设计文档

### 保留文件（已优化）
- `frontend/pages/StatsPage.tsx` - 统计分析页面
- `frontend/pages/LlmRecords/index.tsx` - 数据概览页面

---

## 11. 数据流图

```
用户请求
  ↓
前端路由
  ↓
组件 (SolidJS)
  ↓
API 调用 (ofetch)
  ↓
后端 /api/v1/analytics
  ↓
TimescaleDB 查询
  ↓
连续聚合视图 (run_stats_15min/hourly/daily/weekly/monthly)
  ↓
返回 JSON 数据
  ↓
Chart.js 渲染图表
  ↓
用户查看
```

---

## 12. 部署说明

### 开发环境
```bash
cd frontend
pnpm dev:fe
```
访问：http://localhost:8367

### 生产构建
```bash
pnpm build
```
前端资源会构建到 `dist/public/` 目录

### 环境变量
确保 `.env` 文件包含：
```bash
NODE_ENV=development # 或 production
```

---

## 总结

本次重新设计充分利用了 TimescaleDB 的 5 个连续聚合视图（15分钟/小时/天/周/月级），实现了：

1. **性能仪表板**: 实时监控、健康度评分、异常检测
2. **成本分析**: 多维度成本追踪、模型分布、系统排行
3. **统计分析**: 多粒度自适应、多指标对比
4. **数据概览**: 性能热力图、关键指标高亮（建议）

所有页面都支持多时间范围选择，并自动选择合适的粒度视图，保证查询性能和数据准确性。
