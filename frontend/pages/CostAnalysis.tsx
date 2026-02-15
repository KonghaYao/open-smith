import {
    createSignal,
    createResource,
    For,
    type JSX,
    createMemo,
} from "solid-js";
import { getTimeseries, type TimeseriesQuery } from "../api.js";
import Chart from "../components/Chart.js";
import {
    DollarSign,
    TrendingUp,
    PieChart,
    BarChart3,
    Calendar,
} from "lucide-solid";

// Token 定价模型（示例，可根据实际情况调整）
// 单位：USD per 1M tokens
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    "claude-3-opus": { output: 15, input: 15 },
    "claude-3-sonnet": { input: 3, output: 15 },
    "claude-3-haiku": { input: 0.25, output: 1.25 },
    "claude-3.5-sonnet": { input: 3, output: 15 },
    "mimo-v2-flash": { input: 0.1, output: 0.2 },
};

// 默认价格（每 1M tokens）
const DEFAULT_PRICING = { input: 0.002, output: 0.005 };

const timeRanges = [
    { label: "最近1天", value: "1d" },
    { label: "最近3天", value: "3d" },
    { label: "最近7天", value: "7d" },
    { label: "最近30天", value: "30d" },
    { label: "最近90天", value: "90d" },
];

const getStartTime = (range: string): Date => {
    const d = new Date();
    switch (range) {
        case "1d":
            d.setDate(d.getDate() - 1);
            break;
        case "3d":
            d.setDate(d.getDate() - 3);
            break;
        case "7d":
            d.setDate(d.getDate() - 7);
            break;
        case "30d":
            d.setDate(d.getDate() - 30);
            break;
        case "90d":
            d.setDate(d.getDate() - 90);
            break;
    }
    return d;
};

// 成本卡片组件
const CostCard = (props: {
    title: string;
    value: string;
    trend?: number;
    icon: any;
    color: string;
}): JSX.Element => {
    const trendUp = props.trend !== undefined && props.trend >= 0;
    const trendColor = trendUp ? "text-red-600" : "text-green-600";

    return (
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <div class="flex items-center justify-between">
                <div class={`p-2 rounded-lg ${props.color} bg-opacity-10`}>
                    <props.icon class={`w-5 h-5 ${props.color.replace("bg-", "text-")}`} />
                </div>
                {props.trend !== undefined && (
                    <div class={`flex items-center ${trendColor}`}>
                        {trendUp ? <TrendingUp class="w-4 h-4 mr-1" /> : <TrendingUp class="w-4 h-4 mr-1 rotate-180" />}
                        <span class="text-sm font-medium">{Math.abs(props.trend)}%</span>
                    </div>
                )}
            </div>
            <div class="mt-3">
                <p class="text-sm text-gray-500">{props.title}</p>
                <p class="text-2xl font-bold text-gray-900">{props.value}</p>
            </div>
        </div>
    );
};

const CostAnalysis = (): JSX.Element => {
    const [selectedTimeRange, setSelectedTimeRange] = createSignal("7d");

    // 总体成本趋势
    const [totalCostData] = createResource(selectedTimeRange, async (timeRange) => {
        try {
            const startTime = getStartTime(timeRange);

            const query: TimeseriesQuery = {
                dimension: undefined,
                metrics: ["total_tokens_sum"],
                granularity: "1d",
                start_time: startTime.toISOString(),
                end_time: new Date().toISOString(),
                limit: 1000,
            };

            const response = await getTimeseries(query);
            return response;
        } catch (err) {
            console.error("Failed to fetch total cost data", err);
            return { success: false, data: [], meta: { total: 0, limit: 1000, offset: 0 } };
        }
    });

    // 按模型分组的成本
    const [modelCostData] = createResource(selectedTimeRange, async (timeRange) => {
        try {
            const startTime = getStartTime(timeRange);

            const query: TimeseriesQuery = {
                dimension: "model_name",
                metrics: ["total_tokens_sum", "total_runs"],
                granularity: "1d",
                start_time: startTime.toISOString(),
                end_time: new Date().toISOString(),
                limit: 1000,
            };

            const response = await getTimeseries(query);
            return response;
        } catch (err) {
            console.error("Failed to fetch model cost data", err);
            return { success: false, data: [], meta: { total: 0, limit: 1000, offset: 0 } };
        }
    });

    // 按系统分组的成本
    const [systemCostData] = createResource(selectedTimeRange, async (timeRange) => {
        try {
            const startTime = getStartTime(timeRange);

            const query: TimeseriesQuery = {
                dimension: "system",
                metrics: ["total_tokens_sum", "total_runs"],
                granularity: "1d",
                start_time: startTime.toISOString(),
                end_time: new Date().toISOString(),
                limit: 1000,
            };

            const response = await getTimeseries(query);
            return response;
        } catch (err) {
            console.error("Failed to fetch system cost data", err);
            return { success: false, data: [], meta: { total: 0, limit: 1000, offset: 0 } };
        }
    });

    // 计算总成本
    const totalCost = createMemo(() => {
        const data = totalCostData()?.data || [];
        return data.reduce((sum, d) => {
            const tokens = Number(d.metrics.total_tokens_sum || 0);
            // 使用默认价格：$0.002/1K tokens
            return sum + (tokens * 0.002) / 1000;
        }, 0);
    });

    // 计算日均成本
    const dailyAverageCost = createMemo(() => {
        const data = totalCostData()?.data || [];
        if (data.length === 0) return 0;
        return totalCost() / data.length;
    });

    // 计算预计月度成本
    const estimatedMonthlyCost = createMemo(() => {
        return dailyAverageCost() * 30;
    });

    // 总体成本趋势图表
    const totalCostChartData = createMemo(() => {
        const data = totalCostData()?.data || [];
        if (!data.length) return { labels: [], datasets: [] };

        const labels = data.map((d) => new Date(d.time).toLocaleDateString());
        const costs = data.map((d) => {
            const tokens = Number(d.metrics.total_tokens_sum || 0);
            return (tokens * 0.002) / 1000;
        });

        return {
            labels,
            datasets: [
                {
                    label: "日成本 (USD)",
                    data: costs,
                    borderColor: "rgb(59, 130, 246)",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    tension: 0.4,
                    fill: true,
                },
            ],
        };
    });

    const totalCostChartOptions = createMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        return `$${context.raw?.toFixed(6) || '0.000000'}`;
                    },
                },
            },
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: "日期",
                },
            },
            y: {
                title: {
                    display: true,
                    text: "成本 (USD)",
                },
                beginAtZero: true,
                ticks: {
                    callback: (value: any) => `$${value.toFixed(6)}`,
                },
            },
        },
    }));

    // 按模型成本分布图表
    const modelCostChartData = createMemo(() => {
        const data = modelCostData()?.data || [];

        // 按模型汇总成本，过滤掉模型名称为 null 的记录
        const modelCosts = new Map<string, number>();
        data.forEach((d) => {
            const modelName = d.dimensions?.model_name;
            // 跳过模型名称为 null 的记录
            if (!modelName) return;

            const tokens = Number(d.metrics.total_tokens_sum || 0);
            const pricing = MODEL_PRICING[modelName] || DEFAULT_PRICING;
            const avgPrice = (pricing.input + pricing.output) / 2;
            const cost = (tokens * avgPrice) / 1000000; // Convert to USD

            modelCosts.set(modelName, (modelCosts.get(modelName) || 0) + cost);
        });

        // 只显示有成本的模型
        const entries = Array.from(modelCosts.entries()).filter(([_, cost]) => cost > 0);

        if (entries.length === 0) {
            return { labels: ["暂无数据"], datasets: [{ label: "成本 (USD)", data: [0], backgroundColor: ["rgb(200, 200, 200)"] }] };
        }

        const labels = entries.map(([model]) => model);
        const costs = entries.map(([_, cost]) => cost);

        const colors = [
            "rgb(59, 130, 246)",
            "rgb(16, 185, 129)",
            "rgb(245, 158, 11)",
            "rgb(239, 68, 68)",
            "rgb(139, 92, 246)",
            "rgb(236, 72, 153)",
        ];

        return {
            labels,
            datasets: [
                {
                    label: "成本 (USD)",
                    data: costs,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: colors.slice(0, labels.length),
                    borderWidth: 1,
                },
            ],
        };
    });

    const modelCostChartOptions = createMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "right" as const,
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
                        const percentage = total > 0 ? ((context.raw / total) * 100).toFixed(1) : "0.0";
                        return `${context.label}: $${context.raw?.toFixed(6) || '0.000000'} (${percentage}%)`;
                    },
                },
            },
        },
    }));

    // 按系统成本排行表格
    const systemCostTable = createMemo(() => {
        const data = systemCostData?.()?.data || [];

        // 按系统汇总成本
        const systemCosts = new Map<string, { cost: number; runs: number }>();
        data.forEach((d) => {
            const systemName = d.dimensions?.system || "未知系统";
            const tokens = Number(d.metrics.total_tokens_sum || 0);
            const runs = Number(d.metrics.total_runs || 0);
            const cost = (tokens * 0.002) / 1000;

            const existing = systemCosts.get(systemName) || { cost: 0, runs: 0 };
            systemCosts.set(systemName, {
                cost: existing.cost + cost,
                runs: existing.runs + runs,
            });
        });

        // 排序并返回
        return Array.from(systemCosts.entries())
            .map(([system, stats]) => ({
                system,
                cost: stats.cost,
                runs: stats.runs,
                avgCostPerRun: stats.runs > 0 ? stats.cost / stats.runs : 0,
            }))
            .sort((a, b) => b.cost - a.cost);
    });

    // 计算活跃模型数
    const activeModelCount = createMemo(() => {
        const data = modelCostData?.()?.data || [];
        return new Set(
            data
                .map(d => d.dimensions?.model_name)
                .filter(m => m !== null && m !== undefined)
        ).size;
    });

    return (
        <div class="bg-gray-50 min-h-screen">
            {/* Header */}
            <div class="sticky top-0 z-10 bg-white border-b border-gray-200">
                <div class="p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="text-2xl font-bold text-gray-800">成本分析</h1>
                            <p class="text-sm text-gray-500 mt-1">追踪和优化 LLM 使用成本</p>
                        </div>
                        <div class="flex gap-2">
                            <For each={timeRanges}>
                                {(range) => (
                                    <button
                                        class={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                            selectedTimeRange() === range.value
                                                ? "bg-blue-500 text-white shadow-md"
                                                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                                        }`}
                                        onClick={() => setSelectedTimeRange(range.value)}
                                    >
                                        {range.label}
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div class="p-4 space-y-4">
                {/* Cost Overview Cards */}
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <CostCard
                        title="总成本"
                        value={`$${totalCost().toFixed(6)}`}
                        icon={DollarSign}
                        color="bg-blue-500"
                    />
                    <CostCard
                        title="日均成本"
                        value={`$${dailyAverageCost().toFixed(6)}`}
                        icon={Calendar}
                        color="bg-green-500"
                    />
                    <CostCard
                        title="预计月度成本"
                        value={`$${estimatedMonthlyCost().toFixed(6)}`}
                        icon={TrendingUp}
                        color="bg-orange-500"
                    />
                    <CostCard
                        title="活跃模型数"
                        value={activeModelCount()}
                        icon={PieChart}
                        color="bg-purple-500"
                    />
                </div>

                {/* Cost Trend Chart */}
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                    <h2 class="text-lg font-semibold text-gray-700 mb-4">成本趋势</h2>
                    <div class="h-80">
                        <Chart
                            type="line"
                            data={totalCostChartData()}
                            options={totalCostChartOptions()}
                        />
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Model Cost Distribution */}
                    <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                        <h2 class="text-lg font-semibold text-gray-700 mb-4">按模型成本分布</h2>
                        <div class="h-80">
                            <Chart
                                type="doughnut"
                                data={modelCostChartData()}
                                options={modelCostChartOptions()}
                            />
                        </div>
                    </div>

                    {/* System Cost Ranking */}
                    <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                        <h2 class="text-lg font-semibold text-gray-700 mb-4">按系统成本排行</h2>
                        <div class="overflow-x-auto max-h-80">
                            <table class="w-full text-sm">
                                <thead class="sticky top-0 bg-gray-50">
                                    <tr class="border-b border-gray-200">
                                        <th class="px-4 py-2 text-left font-medium text-gray-700">系统名称</th>
                                        <th class="px-4 py-2 text-right font-medium text-gray-700">成本 (USD)</th>
                                        <th class="px-4 py-2 text-right font-medium text-gray-700">运行次数</th>
                                        <th class="px-4 py-2 text-right font-medium text-gray-700">平均成本/次</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={systemCostTable()}>
                                        {(item) => (
                                            <tr class="border-b border-gray-100">
                                                <td class="px-4 py-2 text-gray-900">{item.system}</td>
                                                <td class="px-4 py-2 text-right text-gray-900">
                                                    ${item.cost.toFixed(6)}
                                                </td>
                                                <td class="px-4 py-2 text-right text-gray-600">
                                                    {item.runs.toLocaleString()}
                                                </td>
                                                <td class="px-4 py-2 text-right text-gray-600">
                                                    ${item.avgCostPerRun.toFixed(8)}
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CostAnalysis;
