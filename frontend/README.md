# Open Smith 前端开发指南

## 项目概述

Open Smith 前端基于 SolidJS 构建，提供 LLM 运行数据追踪、分析和可视化的完整界面。

## 技术栈

- **框架**: SolidJS + TypeScript
- **路由**: @solidjs/router
- **图表**: Chart.js
- **样式**: UnoCSS + Tailwind CSS
- **HTTP客户端**: ofetch
- **图标**: lucide-solid

## 开发环境启动

### 1. 启动前端开发服务器

```bash
cd frontend
pnpm dev:fe
```

前端将运行在：**http://localhost:8367**

### 2. 启动后端服务

```bash
# 在项目根目录
pnpm dev
```

后端将运行在：**http://localhost:7765**

前端会自动代理 API 请求到后端。

---

## 页面路由

### 主页面

| 路由 | 页面名称 | 说明 |
|------|---------|------|
| `#/` | 主页 | 三栏布局：线程列表 / Trace列表 / 运行详情 |
| `#/llm-records` | 数据概览 | 运行记录查询、过滤、详情查看 |

### 统计分析

| 路由 | 页面名称 | 说明 |
|------|---------|------|
| `#/stats` | 统计分析 | 多指标趋势分析、按模型性能趋势 |
| `#/trends` | 趋势分析 | 同比/环比趋势对比 |
| `#/performance` | 性能对比 | 按模型/系统/时间段的性能对比 |

### 监控分析

| 路由 | 页面名称 | 说明 |
|------|---------|------|
| `#/dashboard` | **性能仪表板** | 实时监控、健康度评分、异常检测 |
| `#/anomaly` | 异常检测 | 智能异常检测和告警 |

### 成本管理

| 路由 | 页面名称 | 说明 |
|------|---------|------|
| `#/cost` | **成本分析** | 按模型/系统的成本统计、趋势分析 |

### 系统管理

| 路由 | 页面名称 | 说明 |
|------|---------|------|
| `#/systems` | 系统管理 | 创建系统、管理 API Key |
| `#/playground` | 大模型测试 | 模型调用测试场 |

---

## 新增功能说明

### 1. 性能仪表板 (`#/dashboard`)

**核心功能**：
- 📊 实时关键指标监控（运行次数、成功率、延迟、Token）
- 🎯 健康度评分（0-100分，三色分级）
- 📈 实时趋势图表（多粒度：15分钟/1小时/3小时/12小时/1天/7天）
- 📉 P95/P99 延迟分布图
- 🚨 性能异常检测（高错误率、高延迟告警）

**使用场景**：
- 运维人员实时监控系统状态
- 快速发现性能问题
- 评估系统健康度

---

### 2. 成本分析 (`#/cost`)

**核心功能**：
- 💰 成本概览（总成本、日均、预计月度、活跃模型数）
- 📊 成本趋势图（多时间范围：1天/3天/7天/30天/90天）
- 🥧 按模型成本分布（环形图）
- 📋 按系统成本排行表

**模型定价支持**：
```typescript
const MODEL_PRICING = {
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

**使用场景**：
- 财务团队追踪 LLM 使用成本
- 开发团队优化模型选择
- 管理层了解资源消耗情况

---

## 统计分析改进

### StatsPage (`#/stats`) 增强

**改进点**：
1. **粒度自适应**：根据时间范围自动选择最佳粒度
   - 1-3小时 → 15分钟
   - 12小时 → 30分钟
   - 1-3天 → 1小时
   - 7-30天 → 1天
   - 30天+ → 1周

2. **多指标趋势分析**：
   - 支持 12+ 指标同时展示
   - 自动为不同量级指标分配独立Y轴
   - 多色线条区分

3. **按模型性能趋势**：
   - 单指标多模型对比
   - 颜色区分不同模型

---

## API 使用

### Timeseries API

用于获取时间序列数据：

```typescript
import { getTimeseries, type TimeseriesQuery } from "../api.js";

const query: TimeseriesQuery = {
    dimension: "model_name", // 或 "system", "run_type", "user_id", undefined
    metrics: ["total_runs", "avg_duration_ms", "error_rate"],
    granularity: "1h", // "5min" | "15min" | "30min" | "1h" | "1d" | "1w" | "1m"
    start_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date().toISOString(),
    filters: {
        system: ["my-system"],
        model_name: ["gpt-4o"],
    },
    limit: 1000,
};

const response = await getTimeseries(query);
```

### Summary API

用于获取汇总数据：

```typescript
import { getSummary, type SummaryQuery } from "../api.js";

const response = await getSummary({
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    filters: {
        system: ["my-system"],
    },
});
```

---

## 组件开发

### 创建新页面

1. 在 `frontend/pages/` 目录下创建新页面文件
2. 在 `frontend/main.ts` 中添加路由
3. 在 `frontend/Layout.tsx` 中添加导航菜单项

**示例**：

```typescript
// frontend/pages/MyNewPage.tsx
import { createSignal } from "solid-js";

export default function MyNewPage() {
    const [data, setData] = createSignal([]);

    return (
        <div class="p-4">
            <h1>My New Page</h1>
            {/* 页面内容 */}
        </div>
    );
}
```

```typescript
// frontend/main.ts
Route({
    path: "/my-page",
    component: lazy(() =>
        import("./pages/MyNewPage.tsx").then((res) => {
            return { default: res.default };
        })
    ),
}),
```

---

## 图表使用

使用 Chart.js 组件：

```typescript
import Chart from "../components/Chart.js";

const chartData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May"],
    datasets: [{
        label: "Runs",
        data: [12, 19, 3, 5, 2],
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
    }],
};

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: { beginAtZero: true }
    }
};

<Chart
    type="line"
    data={chartData}
    options={chartOptions}
/>
```

---

## 样式指南

### UnoCSS 类名

项目使用 UnoCSS（类似 Tailwind CSS）：

```tsx
// 布局
<div class="flex h-screen bg-gray-50">
    <div class="w-64 bg-white p-4">Sidebar</div>
    <div class="flex-1 p-6">Content</div>
</div>

// 卡片
<div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
    <h2 class="text-lg font-semibold text-gray-700 mb-3">Title</h2>
    <p class="text-sm text-gray-500">Content</p>
</div>

// 按钮
<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Button
</button>
```

### 图标

使用 lucide-solid：

```tsx
import { Activity, TrendingUp, DollarSign } from "lucide-solid";

<Activity class="w-5 h-5 text-blue-500" />
<TrendingUp class="w-4 h-4 text-green-500" />
<DollarSign class="w-6 h-6 text-gray-700" />
```

---

## 数据库视图映射

前端页面与 TimescaleDB 视图的对应关系：

| 前端页面 | 使用视图 | 粒度 |
|---------|---------|------|
| PerformanceDashboard | `run_stats_15min` | 15分钟 |
| PerformanceDashboard | `run_stats_hourly` | 1小时 |
| StatsPage | `run_stats_hourly` | 1小时 |
| StatsPage | `run_stats_daily` | 1天 |
| StatsPage | `run_stats_weekly` | 1周 |
| CostAnalysis | `run_stats_daily` | 1天 |
| CostAnalysis | `run_stats_weekly` | 1周 |
| CostAnalysis | `run_stats_monthly` | 1月 |
| LlmRecords | `runs` 表 | - |

---

## 故障排查

### 前端无法访问后端

**问题**：API 请求失败

**解决方案**：
1. 确保后端服务正在运行（`pnpm dev`）
2. 检查 `vite.config.ts` 中的代理配置
3. 查看浏览器控制台的错误信息

### 图表不显示

**问题**：图表区域空白

**解决方案**：
1. 检查数据是否正确加载
2. 确保图表容器有明确的高度
3. 查看控制台的 Chart.js 错误

### 样式未生效

**问题**：UnoCSS 类名无效果

**解决方案**：
1. 确保安装了依赖：`pnpm install`
2. 检查类名拼写是否正确
3. 尝试重启开发服务器

---

## 生产构建

```bash
# 构建前端和后端
pnpm build

# 启动生产服务器
pnpm start
```

前端资源会构建到 `dist/public/` 目录，通过后端服务提供访问。

---

## 更多资源

- [SolidJS 文档](https://www.solidjs.com/)
- [UnoCSS 文档](https://unocss.dev/)
- [Chart.js 文档](https://www.chartjs.org/)
- [项目设计文档](./DESIGN.md)

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

在提交代码前，请确保：
1. 代码通过 TypeScript 类型检查
2. 遵循现有的代码风格
3. 添加必要的注释和文档
4. 测试新功能的正常工作
