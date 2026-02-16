import {
    createSignal,
    createResource,
    For,
    type JSX,
    createMemo,
} from "solid-js";
import {
    getTimeseries,
    getSummary,
    type TimeseriesQuery,
    type SummaryQuery,
    fetch,
} from "../api.js";
import Chart from "../components/Chart.js";
import {
    Activity,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Zap,
    Clock,
    Users,
    DollarSign,
    RefreshCw as Refresh,
    BarChart3,
    PieChart,
    Calendar,
} from "lucide-solid";

// 时间范围选项
const timeRanges = [
    { label: "最近15分钟", value: "15m", granularity: "5min" as const },
    { label: "最近1小时", value: "1h", granularity: "15min" as const },
    { label: "最近3小时", value: "3h", granularity: "30min" as const },
    { label: "最近12小时", value: "12h", granularity: "1h" as const },
    { label: "最近1天", value: "1d", granularity: "1h" as const },
    { label: "最近3天", value: "3d", granularity: "1d" as const },
    { label: "最近7天", value: "7d", granularity: "1d" as const },
    { label: "最近30天", value: "30d", granularity: "1d" as const },
];

const getStartTime = (range: string): Date => {
    const d = new Date();
    switch (range) {
        case "15m":
            d.setMinutes(d.getMinutes() - 15);
            break;
        case "1h":
            d.setHours(d.getHours() - 1);
            break;
        case "3h":
            d.setHours(d.getHours() - 3);
            break;
        case "12h":
            d.setHours(d.getHours() - 12);
            break;
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
    }
    return d;
};

const getAxisLabel = (axisId: string): string => {
    switch (axisId) {
        case "y":
            return "计数";
        case "y1":
            return "百分比 (%)";
        case "y2":
            return "持续时间 (s)";
        case "y3":
            return "首包时间 (s)";
        case "y4":
            return "Token 数 (k)";
        default:
            return "值";
    }
};

// Token 定价模型
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

const DEFAULT_PRICING = { input: 0.002, output: 0.005 };

// 多选下拉框组件
const MultiSelect = (props: {
    options: { value: string; label: string }[];
    value: string[];
    onChange: (selected: string[]) => void;
    placeholder: string;
}): JSX.Element => {
    const [isOpen, setIsOpen] = createSignal(false);

    const handleOptionClick = (optionValue: string) => {
        const currentValue = props.value;
        const newValue = currentValue.includes(optionValue)
            ? currentValue.filter((v) => v !== optionValue)
            : [...currentValue, optionValue];
        props.onChange(newValue);
    };

    const selectedLabels = () => {
        return props.options
            .filter((opt) => props.value.includes(opt.value))
            .map((opt) => opt.label);
    };

    return (
        <div class="relative">
            <button
                type="button"
                class="px-2 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 w-48 text-left bg-white flex justify-between items-center text-xs"
                onClick={() => setIsOpen(!isOpen())}
            >
                <span class="truncate">
                    {selectedLabels().length > 0
                        ? selectedLabels().length > 2
                            ? `已选择 ${selectedLabels().length} 项`
                            : selectedLabels().join(", ")
                        : props.placeholder}
                </span>
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen() && (
                <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-auto">
                    <For each={props.options}>
                        {(option) => (
                            <div
                                class={`px-2 py-1 cursor-pointer hover:bg-gray-100 flex items-center text-xs ${
                                    props.value.includes(option.value) ? "bg-blue-50" : ""
                                }`}
                                onClick={() => handleOptionClick(option.value)}
                            >
                                <input
                                    type="checkbox"
                                    checked={props.value.includes(option.value)}
                                    class="mr-2 w-3 h-3"
                                    readOnly
                                />
                                <span>{option.label}</span>
                            </div>
                        )}
                    </For>
                </div>
            )}
        </div>
    );
};

// 性能健康度评分组件
const HealthScore = (props: {
    score: number;
    trend?: "up" | "down" | "stable";
}): JSX.Element => {
    const getColor = () => {
        if (props.score >= 90) return "text-green-600";
        if (props.score >= 70) return "text-yellow-600";
        return "text-red-600";
    };

    const getBgColor = () => {
        if (props.score >= 90) return "bg-green-100";
        if (props.score >= 70) return "bg-yellow-100";
        return "bg-red-100";
    };

    const getTrendIcon = () => {
        if (props.trend === "up") return <TrendingUp class="w-4 h-4" />;
        if (props.trend === "down") return <TrendingDown class="w-4 h-4" />;
        return null;
    };

    return (
        <div class={`inline-flex items-center px-3 py-1 rounded-full ${getBgColor()} ${getColor()}`}>
            <Activity class="w-4 h-4 mr-2" />
            <span class="text-lg font-bold">{props.score}</span>
            <span class="text-sm ml-1">/ 100</span>
            {getTrendIcon()}
        </div>
    );
};

// 关键指标卡片
const MetricCard = (props: {
    title: string;
    value: string | number;
    unit?: string;
    icon: any;
    trend?: number;
    color: string;
}): JSX.Element => {
    const trendUp = props.trend !== undefined && props.trend >= 0;
    const trendColor = trendUp ? "text-green-600" : "text-red-600";

    return (
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <div class="flex items-center justify-between">
                <div class={`p-2 rounded-lg ${props.color} bg-opacity-10`}>
                    <props.icon class={`w-5 h-5 ${props.color.replace("bg-", "text-")}`} />
                </div>
                {props.trend !== undefined && (
                    <div class={`flex items-center ${trendColor}`}>
                        {trendUp ? <TrendingUp class="w-4 h-4 mr-1" /> : <TrendingDown class="w-4 h-4 mr-1" />}
                        <span class="text-sm font-medium">{Math.abs(props.trend)}%</span>
                    </div>
                )}
            </div>
            <div class="mt-3">
                <p class="text-sm text-gray-500">{props.title}</p>
                <p class="text-2xl font-bold text-gray-900">
                    {typeof props.value === "number" ? props.value.toLocaleString() : props.value}
                    {props.unit && <span class="text-sm text-gray-500 ml-1">{props.unit}</span>}
                </p>
            </div>
        </div>
    );
};

const UnifiedDashboard = (): JSX.Element => {
    const [activeTab, setActiveTab] = createSignal<"stats" | "performance" | "cost">("performance");
    const [selectedTimeRange, setSelectedTimeRange] = createSignal("1h");
    const [refreshKey, setRefreshKey] = createSignal(0);

    // 筛选器
    const [filters, setFilters] = createSignal({
        modelName: null as string | null,
        system: null as string | null,
    });

    // 选中的统计指标
    const [selectedMetrics, setSelectedMetrics] = createSignal<string[]>([
        "total_runs",
        "p99_duration_ms",
        "total_tokens_sum",
        "distinct_users",
    ]);

    // 按模型统计趋势的指标
    const [selectedMetric, setSelectedMetric] = createSignal<string>("total_runs");

    const availableMetrics: {
        value: string;
        label: string;
        yAxisId?: string;
    }[] = [
        { value: "total_runs", label: "总运行次数", yAxisId: "y" },
        { value: "successful_runs", label: "成功次数", yAxisId: "y" },
        { value: "failed_runs", label: "失败次数", yAxisId: "y" },
        { value: "error_rate", label: "错误率 (%)", yAxisId: "y1" },
        { value: "avg_duration_ms", label: "平均持续时间 (s)", yAxisId: "y2" },
        { value: "p95_duration_ms", label: "P95 持续时间 (s)", yAxisId: "y2" },
        { value: "p99_duration_ms", label: "P99 持续时间 (s)", yAxisId: "y2" },
        { value: "avg_ttft_ms", label: "平均首包时间 (s)", yAxisId: "y3" },
        { value: "p95_ttft_ms", label: "P95 首包时间 (s)", yAxisId: "y3" },
        { value: "total_tokens_sum", label: "总 Token 数 (k)", yAxisId: "y4" },
        {
            value: "avg_tokens_per_run",
            label: "平均 Token 数 (k)",
            yAxisId: "y4",
        },
        { value: "distinct_users", label: "独立用户数", yAxisId: "y" },
    ];

    const metricColors = [
        "rgb(75, 192, 192)",
        "rgb(255, 99, 132)",
        "rgb(53, 162, 235)",
        "rgb(255, 206, 86)",
        "rgb(153, 102, 255)",
        "rgb(255, 159, 64)",
    ];

    const modelColors = [
        "rgb(75, 192, 192)",
        "rgb(255, 99, 132)",
        "rgb(53, 162, 235)",
        "rgb(255, 206, 86)",
        "rgb(153, 102, 255)",
        "rgb(255, 159, 64)",
    ];

    // 数据资源
    const [performanceData] = createResource(
        () => ({ timeRange: selectedTimeRange(), key: refreshKey() }),
        async ({ timeRange }) => {
            try {
                const granularity = timeRanges.find((r) => r.value === timeRange)?.granularity || "15min";
                const startTime = getStartTime(timeRange);

                const query: TimeseriesQuery = {
                    dimension: undefined,
                    metrics: [
                        "total_runs",
                        "successful_runs",
                        "failed_runs",
                        "error_rate",
                        "avg_duration_ms",
                        "p95_duration_ms",
                        "p99_duration_ms",
                        "avg_ttft_ms",
                        "p95_ttft_ms",
                        "total_tokens_sum",
                        "distinct_users",
                    ],
                    granularity,
                    start_time: startTime.toISOString(),
                    end_time: new Date().toISOString(),
                    limit: 1000,
                };

                return await getTimeseries(query);
            } catch (err) {
                console.error("Failed to fetch performance data", err);
                return { success: false, data: [], meta: { total: 0, limit: 1000, offset: 0 } };
            }
        },
    );

    const [summaryData] = createResource(
        () => ({ timeRange: selectedTimeRange(), key: refreshKey() }),
        async ({ timeRange }) => {
            try {
                const startTime = getStartTime(timeRange);
                return await getSummary({
                    start_time: startTime.toISOString(),
                    end_time: new Date().toISOString(),
                });
            } catch (err) {
                console.error("Failed to fetch summary data", err);
                return { success: false, data: null };
            }
        },
    );

    const [statsTimeseriesData] = createResource(
        () => ({ timeRange: selectedTimeRange(), key: refreshKey(), filters: filters() }),
        async ({ timeRange, filters: currentFilters }) => {
            try {
                const granularity = timeRanges.find((r) => r.value === timeRange)?.granularity || "15min";
                const startTime = getStartTime(timeRange);

                const filtersObj: Record<string, string[]> = {};
                if (currentFilters.modelName) filtersObj.model_name = [currentFilters.modelName];
                if (currentFilters.system) filtersObj.system = [currentFilters.system];

                const query: TimeseriesQuery = {
                    dimension: undefined,
                    metrics: [
                        "total_runs",
                        "successful_runs",
                        "failed_runs",
                        "error_rate",
                        "avg_duration_ms",
                        "p95_duration_ms",
                        "p99_duration_ms",
                        "total_tokens_sum",
                        "avg_tokens_per_run",
                        "avg_ttft_ms",
                        "distinct_users",
                    ],
                    granularity,
                    start_time: startTime.toISOString(),
                    end_time: new Date().toISOString(),
                    filters: Object.keys(filtersObj).length > 0 ? filtersObj : undefined,
                    limit: 1000,
                };

                return await getTimeseries(query);
            } catch (err) {
                console.error("Failed to fetch stats timeseries data", err);
                return { success: false, data: [], meta: { total: 0, limit: 1000, offset: 0 } };
            }
        },
    );

    const [modelTimeseriesData] = createResource(
        () => ({ timeRange: selectedTimeRange(), key: refreshKey(), filters: filters() }),
        async ({ timeRange, filters: currentFilters }) => {
            try {
                const granularity = timeRanges.find((r) => r.value === timeRange)?.granularity || "15min";
                const startTime = getStartTime(timeRange);

                const filtersObj: Record<string, string[]> = {};
                if (currentFilters.system) filtersObj.system = [currentFilters.system];

                const query: TimeseriesQuery = {
                    dimension: "model_name",
                    metrics: [
                        "total_runs",
                        "successful_runs",
                        "failed_runs",
                        "error_rate",
                        "avg_duration_ms",
                        "p95_duration_ms",
                        "p99_duration_ms",
                        "total_tokens_sum",
                        "avg_tokens_per_run",
                        "avg_ttft_ms",
                    ],
                    granularity,
                    start_time: startTime.toISOString(),
                    end_time: new Date().toISOString(),
                    filters: Object.keys(filtersObj).length > 0 ? filtersObj : undefined,
                    limit: 1000,
                };

                return await getTimeseries(query);
            } catch (err) {
                console.error("Failed to fetch model timeseries data", err);
                return { success: false, data: [], meta: { total: 0, limit: 1000, offset: 0 } };
            }
        },
    );

    const [costTimeseriesData] = createResource(
        () => ({ timeRange: selectedTimeRange(), key: refreshKey() }),
        async ({ timeRange }) => {
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

                return await getTimeseries(query);
            } catch (err) {
                console.error("Failed to fetch cost timeseries data", err);
                return { success: false, data: [], meta: { total: 0, limit: 1000, offset: 0 } };
            }
        },
    );

    const [costModelData] = createResource(
        () => ({ timeRange: selectedTimeRange(), key: refreshKey() }),
        async ({ timeRange }) => {
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

                return await getTimeseries(query);
            } catch (err) {
                console.error("Failed to fetch cost model data", err);
                return { success: false, data: [], meta: { total: 0, limit: 1000, offset: 0 } };
            }
        },
    );

    const [costSystemData] = createResource(
        () => ({ timeRange: selectedTimeRange(), key: refreshKey() }),
        async ({ timeRange }) => {
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

                return await getTimeseries(query);
            } catch (err) {
                console.error("Failed to fetch cost system data", err);
                return { success: false, data: [], meta: { total: 0, limit: 1000, offset: 0 } };
            }
        },
    );

    const [availableFilters] = createResource(async () => {
        try {
            const [models, systems] = await Promise.all([
                fetch("/trace/models"),
                fetch("/trace/systems"),
            ]);
            return {
                modelNames: (models.model_names || []) as string[],
                systems: (systems.systems || []) as string[],
            };
        } catch (err) {
            console.error("Failed to fetch available filters", err);
            return { modelNames: [], systems: [] };
        }
    });

    // 计算属性
    const healthScore = createMemo(() => {
        const summary = summaryData()?.data;
        if (!summary) return 0;

        const successRateScore = summary.runs?.success_rate || 0;
        const performanceScore = summary.performance?.avg_duration_ms
            ? Math.max(0, 100 - (summary.performance.avg_duration_ms / 5000) * 100)
            : 100;
        const tokenScore = summary.tokens?.avg_per_run
            ? Math.max(0, 100 - (summary.tokens.avg_per_run / 10000) * 20)
            : 100;

        return Math.round((successRateScore * 0.5 + performanceScore * 0.3 + tokenScore * 0.2));
    });

    const mergedPerformanceData = createMemo(() => {
        const rawData = performanceData?.()?.data || [];
        if (!rawData.length) return [];

        const dataMap = new Map<string, any>();
        rawData.forEach((item) => {
            const time = item.time;
            if (!dataMap.has(time)) {
                dataMap.set(time, { ...item });
            } else {
                const existing = dataMap.get(time)!;
                Object.keys(item.metrics).forEach((key) => {
                    const newValue = item.metrics[key];
                    if (newValue !== null && newValue !== undefined) {
                        existing.metrics[key] = newValue;
                    }
                });
            }
        });

        return Array.from(dataMap.values())
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    });

    // 成本相关计算
    const totalCost = createMemo(() => {
        const data = costTimeseriesData?.()?.data || [];
        return data.reduce((sum, d) => {
            const tokens = Number(d.metrics.total_tokens_sum || 0);
            return sum + (tokens * 0.002) / 1000;
        }, 0);
    });

    const dailyAverageCost = createMemo(() => {
        const data = costTimeseriesData?.()?.data || [];
        if (data.length === 0) return 0;
        return totalCost() / data.length;
    });

    const estimatedMonthlyCost = createMemo(() => {
        return dailyAverageCost() * 30;
    });

    const activeModelCount = createMemo(() => {
        const data = costModelData?.()?.data || [];
        return new Set(
            data.map((d) => d.dimensions?.model_name).filter((m) => m !== null && m !== undefined),
        ).size;
    });

    // 图表数据计算
    const runsChartData = createMemo(() => {
        const data = performanceData?.()?.data || [];
        if (!data.length) return { labels: [], datasets: [] };

        const labels = data.map((d) => new Date(d.time).toLocaleString());

        return {
            labels,
            datasets: [
                {
                    label: "总运行次数",
                    data: data.map((d) => d.metrics.total_runs || 0),
                    borderColor: "rgb(59, 130, 246)",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    tension: 0.4,
                    fill: true,
                },
                {
                    label: "成功次数",
                    data: data.map((d) => d.metrics.successful_runs || 0),
                    borderColor: "rgb(34, 197, 94)",
                    backgroundColor: "rgba(34, 197, 94, 0.1)",
                    tension: 0.4,
                },
                {
                    label: "失败次数",
                    data: data.map((d) => d.metrics.failed_runs || 0),
                    borderColor: "rgb(239, 68, 68)",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    tension: 0.4,
                },
            ],
        };
    });

    const latencyChartData = createMemo(() => {
        const data = performanceData?.()?.data || [];
        if (!data.length) return { labels: [], datasets: [] };

        const labels = data.map((d) => new Date(d.time).toLocaleString());

        return {
            labels,
            datasets: [
                {
                    label: "平均延迟 (s)",
                    data: data.map((d) => (d.metrics.avg_duration_ms || 0) / 1000),
                    borderColor: "rgb(59, 130, 246)",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    tension: 0.4,
                    fill: false,
                },
                {
                    label: "P95 延迟 (s)",
                    data: data.map((d) => (d.metrics.p95_duration_ms || 0) / 1000),
                    borderColor: "rgb(249, 115, 22)",
                    backgroundColor: "rgba(249, 115, 22, 0.1)",
                    tension: 0.4,
                    fill: false,
                },
                {
                    label: "P99 延迟 (s)",
                    data: data.map((d) => (d.metrics.p99_duration_ms || 0) / 1000),
                    borderColor: "rgb(239, 68, 68)",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    tension: 0.4,
                    fill: false,
                },
            ],
        };
    });

    const ttftChartData = createMemo(() => {
        const data = performanceData?.()?.data || [];
        if (!data.length) return { labels: [], datasets: [] };

        const labels = data.map((d) => new Date(d.time).toLocaleString());

        return {
            labels,
            datasets: [
                {
                    label: "平均首包时间 (s)",
                    data: data.map((d) => (d.metrics.avg_ttft_ms || 0) / 1000),
                    borderColor: "rgb(139, 92, 246)",
                    backgroundColor: "rgba(139, 92, 246, 0.1)",
                    tension: 0.4,
                    fill: true,
                },
                {
                    label: "P95 首包时间 (s)",
                    data: data.map((d) => (d.metrics.p95_ttft_ms || 0) / 1000),
                    borderColor: "rgb(236, 72, 153)",
                    backgroundColor: "rgba(236, 72, 153, 0.1)",
                    tension: 0.4,
                    fill: false,
                },
            ],
        };
    });

    const tokensChartData = createMemo(() => {
        const data = performanceData?.()?.data || [];
        if (!data.length) return { labels: [], datasets: [] };

        const labels = data.map((d) => new Date(d.time).toLocaleString());

        return {
            labels,
            datasets: [
                {
                    label: "Token 消耗 (k)",
                    data: data.map((d) => (d.metrics.total_tokens_sum || 0) / 1000),
                    borderColor: "rgb(16, 185, 129)",
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    tension: 0.4,
                    fill: true,
                },
            ],
        };
    });

    // 成本图表数据
    const totalCostChartData = createMemo(() => {
        const data = costTimeseriesData?.()?.data || [];
        if (!data.length) return { labels: [], datasets: [] };

        const dailyCosts = new Map<string, number>();
        data.forEach((d) => {
            const date = new Date(d.time).toLocaleDateString();
            const tokens = Number(d.metrics.total_tokens_sum || 0);
            const cost = (tokens * 0.002) / 1000;
            dailyCosts.set(date, (dailyCosts.get(date) || 0) + cost);
        });

        const labels = Array.from(dailyCosts.keys()).sort(
            (a, b) => new Date(a).getTime() - new Date(b).getTime(),
        );
        const costs = labels.map((date) => dailyCosts.get(date) || 0);

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

    const modelCostChartData = createMemo(() => {
        const data = costModelData?.()?.data || [];

        const modelCosts = new Map<string, number>();
        data.forEach((d) => {
            const modelName = d.dimensions?.model_name;
            if (!modelName) return;

            const tokens = Number(d.metrics.total_tokens_sum || 0);
            const pricing = MODEL_PRICING[modelName] || DEFAULT_PRICING;
            const avgPrice = (pricing.input + pricing.output) / 2;
            const cost = (tokens * avgPrice) / 1000000;

            modelCosts.set(modelName, (modelCosts.get(modelName) || 0) + cost);
        });

        const entries = Array.from(modelCosts.entries()).filter(([_, cost]) => cost > 0);

        if (entries.length === 0) {
            return {
                labels: ["暂无数据"],
                datasets: [{ label: "成本 (USD)", data: [0], backgroundColor: ["rgb(200, 200, 200)"] }],
            };
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

    const systemCostTable = createMemo(() => {
        const data = costSystemData?.()?.data || [];

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

        return Array.from(systemCosts.entries())
            .map(([system, stats]) => ({
                system,
                cost: stats.cost,
                runs: stats.runs,
                avgCostPerRun: stats.runs > 0 ? stats.cost / stats.runs : 0,
            }))
            .sort((a, b) => b.cost - a.cost);
    });

    // 统计分析图表数据
    const statsChartData = createMemo(() => {
        const data = statsTimeseriesData?.()?.data || [];
        const metrics = selectedMetrics();

        if (!data.length || !metrics.length) return { labels: [], datasets: [] };

        const labels = data.map((d) => new Date(d.time).toLocaleString());

        const datasets = metrics.map((metric, index) => {
            const metricInfo = availableMetrics.find((m) => m.value === metric);
            const values = data.map((d) => {
                let value = d.metrics[metric] as number;
                if (metric === "error_rate") {
                    value = value ? value * 100 : 0;
                } else if (metric.includes("duration_ms") || metric.includes("ttft_ms")) {
                    value = value ? value / 1000 : 0;
                } else if (metric.includes("tokens")) {
                    value = value ? value / 1000 : 0;
                }
                return value;
            });

            return {
                label: metricInfo?.label || "",
                data: values,
                borderColor: metricColors[index % metricColors.length],
                backgroundColor: metricColors[index % metricColors.length]
                    .replace("rgb", "rgba")
                    .replace(")", ", 0.2)"),
                tension: 0.1,
                yAxisID: metricInfo?.yAxisId || "y",
            };
        });

        return { labels, datasets };
    });

    const statsChartOptions = createMemo(() => {
        const metrics = selectedMetrics();
        const yAxes: Record<string, any> = {};

        const usedAxes = new Set<string>();
        metrics.forEach((metric) => {
            const metricInfo = availableMetrics.find((m) => m.value === metric);
            if (metricInfo?.yAxisId) usedAxes.add(metricInfo.yAxisId);
        });

        const axisPositions = ["left", "right"];
        let axisIndex = 0;

        usedAxes.forEach((axisId) => {
            const position = axisPositions[axisIndex % axisPositions.length];
            const offset = Math.floor(axisIndex / axisPositions.length) > 0;

            yAxes[axisId] = {
                type: "linear",
                display: true,
                position: position,
                ...(offset && {
                    offset: true,
                    grid: {
                        drawOnChartArea: false,
                    },
                }),
                title: {
                    display: true,
                    text: getAxisLabel(axisId),
                },
                beginAtZero: true,
            };
            axisIndex++;
        });

        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index" as const,
                intersect: false,
            },
            plugins: {
                legend: {
                    position: "top" as const,
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "时间",
                    },
                },
                ...yAxes,
            },
        };
    });

    const newModelChartData = createMemo(() => {
        const data = modelTimeseriesData?.()?.data || [];
        const metric = selectedMetric();

        if (!data.length) return { labels: [], datasets: [] };

        const uniqueTimes = Array.from(new Set(data.map((d) => d.time))).sort();

        const dataByModel = new Map<string, Map<string, number>>();

        data.forEach((d) => {
            const modelName = d.dimensions?.model_name || "未知模型";
            if (!dataByModel.has(modelName)) {
                dataByModel.set(modelName, new Map());
            }
            let value = d.metrics[metric] as number;
            if (metric === "error_rate") {
                value = value ? value * 100 : 0;
            } else if (metric.includes("duration_ms") || metric.includes("ttft_ms")) {
                value = value ? value / 1000 : 0;
            } else if (metric.includes("tokens")) {
                value = value ? value / 1000 : 0;
            }
            dataByModel.get(modelName)!.set(d.time, value);
        });

        const datasets: any[] = [];
        let index = 0;
        dataByModel.forEach((modelData, modelName) => {
            const color = modelColors[index % modelColors.length];
            const values = uniqueTimes.map((time) => modelData.get(time) ?? null);
            datasets.push({
                label: modelName,
                data: values,
                borderColor: color,
                backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.5)"),
                tension: 0.1,
            });
            index++;
        });

        return {
            labels: uniqueTimes.map((time) => new Date(time).toLocaleString()),
            datasets,
        };
    });

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
    };

    const handleFilterChange = <K extends keyof { modelName: string | null; system: string | null }>(
        type: K,
        value: any,
    ) => {
        setFilters((prev) => ({ ...prev, [type]: value }));
    };

    const handleSelectChange = (type: "modelName" | "system", event: Event) => {
        const target = event.target as HTMLSelectElement;
        handleFilterChange(type, target.value || null);
    };

    const handleMetricChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        setSelectedMetric(target.value);
    };

    const tabs = [
        { id: "performance" as const, label: "性能监控", icon: <Activity class="w-4 h-4 mr-2" /> },
        { id: "stats" as const, label: "统计分析", icon: <BarChart3 class="w-4 h-4 mr-2" /> },
        { id: "cost" as const, label: "成本分析", icon: <DollarSign class="w-4 h-4 mr-2" /> },
    ];

    return (
        <div class="bg-gray-50 min-h-screen">
            {/* Header */}
            <div class="sticky top-0 z-10 bg-white border-b border-gray-200">
                <div class="p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="text-2xl font-bold text-gray-800">数据分析仪表板</h1>
                            <p class="text-sm text-gray-500 mt-1">实时监控、统计分析与成本追踪</p>
                        </div>
                        <div class="flex items-center gap-3">
                            {activeTab() === "performance" && <HealthScore score={healthScore()} />}
                            <button
                                onClick={handleRefresh}
                                class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                            >
                                <Refresh class="w-4 h-4 mr-1.5" />
                                刷新
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div class="flex gap-4 mt-4 border-b border-gray-200">
                        <For each={tabs}>
                            {(tab) => (
                                <button
                                    class={`px-4 py-2 flex items-center font-medium transition-colors border-b-2 -mb-px ${
                                        activeTab() === tab.id
                                            ? "border-blue-500 text-blue-600"
                                            : "border-transparent text-gray-500 hover:text-gray-700"
                                    }`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            )}
                        </For>
                    </div>

                    {/* Time Range Selector */}
                    <div class="flex gap-2 mt-4 flex-wrap">
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

            {/* Content */}
            <div class="p-4 space-y-4">
                {/* 性能监控 Tab */}
                {activeTab() === "performance" && summaryData()?.data && (
                    <>
                        {/* Key Metrics */}
                        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            <MetricCard
                                title="总运行次数"
                                value={summaryData()?.data?.runs?.total || 0}
                                unit="次"
                                icon={Activity}
                                color="bg-blue-500"
                            />
                            <MetricCard
                                title="成功率"
                                value={((summaryData()?.data?.runs?.success_rate || 0) * 100).toFixed(1)}
                                unit="%"
                                icon={TrendingUp}
                                color="bg-green-500"
                            />
                            <MetricCard
                                title="平均延迟"
                                value={((summaryData()?.data?.performance?.avg_duration_ms || 0) / 1000).toFixed(2)}
                                unit="s"
                                icon={Clock}
                                color="bg-yellow-500"
                            />
                            <MetricCard
                                title="P95 延迟"
                                value={((summaryData()?.data?.performance?.p95_duration_ms || 0) / 1000).toFixed(2)}
                                unit="s"
                                icon={Zap}
                                color="bg-orange-500"
                            />
                            <MetricCard
                                title="独立用户"
                                value={summaryData()?.data?.users?.distinct || 0}
                                icon={Users}
                                color="bg-purple-500"
                            />
                            <MetricCard
                                title="Token 消耗"
                                value={((summaryData()?.data?.tokens?.total || 0) / 1000).toFixed(0)}
                                unit="k"
                                icon={DollarSign}
                                color="bg-indigo-500"
                            />
                        </div>

                        {/* Charts Row 1 */}
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <h2 class="text-lg font-semibold text-gray-700 mb-4">运行次数趋势</h2>
                                <div class="h-72">
                                    {runsChartData().labels.length > 0 ? (
                                        <Chart type="line" data={runsChartData()} options={statsChartOptions()} />
                                    ) : (
                                        <div class="flex items-center justify-center h-full text-gray-500">暂无数据</div>
                                    )}
                                </div>
                            </div>

                            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <h2 class="text-lg font-semibold text-gray-700 mb-4">延迟性能</h2>
                                <div class="h-72">
                                    {latencyChartData().labels.length > 0 ? (
                                        <Chart
                                            type="line"
                                            data={latencyChartData()}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                interaction: { mode: "index" as const, intersect: false },
                                                plugins: { legend: { position: "top" as const } },
                                                scales: {
                                                    x: { title: { display: true, text: "时间" } },
                                                    y: { title: { display: true, text: "延迟 (秒)" }, beginAtZero: true },
                                                },
                                            }}
                                        />
                                    ) : (
                                        <div class="flex items-center justify-center h-full text-gray-500">暂无数据</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Charts Row 2 */}
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <h2 class="text-lg font-semibold text-gray-700 mb-4">首包时间 (TTFT)</h2>
                                <div class="h-72">
                                    {ttftChartData().labels.length > 0 ? (
                                        <Chart
                                            type="line"
                                            data={ttftChartData()}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                interaction: { mode: "index" as const, intersect: false },
                                                plugins: { legend: { position: "top" as const } },
                                                scales: {
                                                    x: { title: { display: true, text: "时间" } },
                                                    y: { title: { display: true, text: "首包时间 (秒)" }, beginAtZero: true },
                                                },
                                            }}
                                        />
                                    ) : (
                                        <div class="flex items-center justify-center h-full text-gray-500">暂无数据</div>
                                    )}
                                </div>
                            </div>

                            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <h2 class="text-lg font-semibold text-gray-700 mb-4">Token 消耗趋势</h2>
                                <div class="h-72">
                                    {tokensChartData().labels.length > 0 ? (
                                        <Chart
                                            type="line"
                                            data={tokensChartData()}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                interaction: { mode: "index" as const, intersect: false },
                                                plugins: { legend: { position: "top" as const } },
                                                scales: {
                                                    x: { title: { display: true, text: "时间" } },
                                                    y: { title: { display: true, text: "Token 数 (k)" }, beginAtZero: true },
                                                },
                                            }}
                                        />
                                    ) : (
                                        <div class="flex items-center justify-center h-full text-gray-500">暂无数据</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Performance Alerts */}
                        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                            <h2 class="text-lg font-semibold text-gray-700 mb-4">性能异常检测</h2>
                            <div class="space-y-2">
                                {(() => {
                                    const data = mergedPerformanceData();
                                    const lastDataPoint = data[data.length - 1];
                                    const alerts: JSX.Element[] = [];

                                    if (lastDataPoint?.metrics.error_rate > 0.1) {
                                        alerts.push(
                                            <div class="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <AlertTriangle class="w-5 h-5 text-red-600 mr-3" />
                                                <div class="flex-1">
                                                    <p class="text-sm font-medium text-red-800">高错误率警告</p>
                                                    <p class="text-xs text-red-600">
                                                        当前错误率 {((lastDataPoint.metrics.error_rate || 0) * 100).toFixed(2)}%
                                                    </p>
                                                </div>
                                            </div>,
                                        );
                                    }

                                    if ((lastDataPoint?.metrics.avg_duration_ms || 0) > 5000) {
                                        alerts.push(
                                            <div class="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <AlertTriangle class="w-5 h-5 text-yellow-600 mr-3" />
                                                <div class="flex-1">
                                                    <p class="text-sm font-medium text-yellow-800">高延迟警告</p>
                                                    <p class="text-xs text-yellow-600">
                                                        平均延迟 {((lastDataPoint.metrics.avg_duration_ms || 0) / 1000).toFixed(2)}s
                                                    </p>
                                                </div>
                                            </div>,
                                        );
                                    }

                                    return alerts.length > 0 ? (
                                        alerts
                                    ) : (
                                        <div class="text-center py-8 text-gray-500">
                                            <Activity class="mx-auto h-8 w-8 text-green-500 mb-2" />
                                            <p class="text-sm">系统运行正常，未检测到异常</p>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </>
                )}

                {/* 统计分析 Tab */}
                {activeTab() === "stats" && (
                    <div class="space-y-4">
                        {/* Filters */}
                        <div class="flex gap-2 items-center flex-wrap bg-white p-3 border border-gray-200 rounded-lg">
                            <select
                                class="px-2 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 w-32 text-xs"
                                onchange={(e) => handleSelectChange("modelName", e)}
                            >
                                <option value="">所有模型</option>
                                <For each={availableFilters()?.modelNames}>
                                    {(name) => <option value={name}>{name}</option>}
                                </For>
                            </select>

                            <select
                                class="px-2 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 w-32 text-xs"
                                onchange={(e) => handleSelectChange("system", e)}
                            >
                                <option value="">所有系统</option>
                                <For each={availableFilters()?.systems}>
                                    {(sys) => <option value={sys}>{sys}</option>}
                                </For>
                            </select>
                        </div>

                        {/* Charts */}
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <div class="flex justify-between items-center mb-3">
                                    <h2 class="text-lg font-semibold text-gray-700">多指标趋势分析</h2>
                                    <MultiSelect
                                        options={availableMetrics.map((m) => ({
                                            value: m.value,
                                            label: m.label,
                                        }))}
                                        value={selectedMetrics()}
                                        onChange={setSelectedMetrics}
                                        placeholder="选择统计指标"
                                    />
                                </div>
                                <div class="h-80">
                                    {statsChartData().labels.length > 0 && selectedMetrics().length ? (
                                        <Chart type="line" data={statsChartData()} options={statsChartOptions()} />
                                    ) : (
                                        <div class="text-center p-8 text-gray-500">
                                            {selectedMetrics().length === 0 ? "请选择至少一个统计指标" : "暂无数据"}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <div class="flex justify-between items-center mb-3">
                                    <h2 class="text-lg font-semibold text-gray-700">模型性能趋势</h2>
                                    <select
                                        class="px-2 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 w-40 text-xs"
                                        onchange={(e) => handleMetricChange(e)}
                                    >
                                        <option value="total_runs">总运行次数</option>
                                        <option value="successful_runs">成功次数</option>
                                        <option value="failed_runs">失败次数</option>
                                        <option value="error_rate">错误率</option>
                                        <option value="avg_duration_ms">平均持续时间</option>
                                        <option value="p95_duration_ms">P95 持续时间</option>
                                        <option value="p99_duration_ms">P99 持续时间</option>
                                        <option value="avg_ttft_ms">平均首包时间</option>
                                        <option value="p95_ttft_ms">P95 首包时间</option>
                                        <option value="total_tokens_sum">总 Token 数</option>
                                        <option value="avg_tokens_per_run">平均 Token 数</option>
                                    </select>
                                </div>
                                <div class="h-80">
                                    {newModelChartData()?.datasets.length ? (
                                        <Chart
                                            type="line"
                                            data={newModelChartData()}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: { legend: { position: "top" as const } },
                                                scales: {
                                                    x: { title: { display: true, text: "时间" } },
                                                    y: { title: { display: true, text: "值" }, beginAtZero: true },
                                                },
                                            }}
                                        />
                                    ) : (
                                        <div class="text-center p-8 text-gray-500">暂无数据</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Data Table */}
                        {statsTimeseriesData?.()?.data?.length > 0 && (
                            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <h2 class="text-lg font-semibold text-gray-700 mb-3">数据详情</h2>
                                <div class="overflow-x-auto max-h-96">
                                    <table class="w-full text-sm">
                                        <thead class="bg-gray-50 sticky top-0">
                                            <tr class="border-b border-gray-200">
                                                <th class="px-4 py-2 text-left font-medium text-gray-700">时间</th>
                                                <th class="px-4 py-2 text-left font-medium text-gray-700">总运行次数</th>
                                                <th class="px-4 py-2 text-left font-medium text-gray-700">成功/失败</th>
                                                <th class="px-4 py-2 text-left font-medium text-gray-700">错误率</th>
                                                <th class="px-4 py-2 text-left font-medium text-gray-700">平均延迟</th>
                                                <th class="px-4 py-2 text-left font-medium text-gray-700">Token 数</th>
                                                <th class="px-4 py-2 text-left font-medium text-gray-700">独立用户数</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-200">
                                            <For each={statsTimeseriesData?.()?.data || []}>
                                                {(item) => (
                                                    <tr class="hover:bg-gray-50">
                                                        <td class="px-4 py-2 text-gray-900">{new Date(item.time).toLocaleString()}</td>
                                                        <td class="px-4 py-2 text-gray-900">{(item.metrics.total_runs || 0).toLocaleString()}</td>
                                                        <td class="px-4 py-2 text-gray-600">
                                                            {(item.metrics.successful_runs || 0).toLocaleString()} /{" "}
                                                            {(item.metrics.failed_runs || 0).toLocaleString()}
                                                        </td>
                                                        <td class="px-4 py-2 text-gray-900">{((item.metrics.error_rate || 0) * 100).toFixed(2)}%</td>
                                                        <td class="px-4 py-2 text-gray-900">{((item.metrics.avg_duration_ms || 0) / 1000).toFixed(2)} s</td>
                                                        <td class="px-4 py-2 text-gray-900">{((item.metrics.total_tokens_sum || 0) / 1000).toFixed(1)} k</td>
                                                        <td class="px-4 py-2 text-gray-900">{(item.metrics.distinct_users || 0).toLocaleString()}</td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 成本分析 Tab */}
                {activeTab() === "cost" && (
                    <div class="space-y-4">
                        {/* Cost Overview Cards */}
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <MetricCard title="总成本" value={`$${totalCost().toFixed(6)}`} icon={DollarSign} color="bg-blue-500" />
                            <MetricCard title="日均成本" value={`$${dailyAverageCost().toFixed(6)}`} icon={Calendar} color="bg-green-500" />
                            <MetricCard title="预计月度成本" value={`$${estimatedMonthlyCost().toFixed(6)}`} icon={TrendingUp} color="bg-orange-500" />
                            <MetricCard title="活跃模型数" value={activeModelCount()} icon={PieChart} color="bg-purple-500" />
                        </div>

                        {/* Cost Trend Chart */}
                        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                            <h2 class="text-lg font-semibold text-gray-700 mb-4">成本趋势</h2>
                            <div class="h-80">
                                {totalCostChartData().labels.length > 0 ? (
                                    <Chart
                                        type="line"
                                        data={totalCostChartData()}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: { display: false },
                                                tooltip: { callbacks: { label: (context: any) => `$${context.raw?.toFixed(6) || '0.000000'}` } },
                                            },
                                            scales: {
                                                x: { title: { display: true, text: "日期" } },
                                                y: {
                                                    title: { display: true, text: "成本 (USD)" },
                                                    beginAtZero: true,
                                                    ticks: { callback: (value: any) => `$${value.toFixed(6)}` },
                                                },
                                            },
                                        }}
                                    />
                                ) : (
                                    <div class="flex items-center justify-center h-full text-gray-500">暂无成本趋势数据</div>
                                )}
                            </div>
                        </div>

                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Model Cost Distribution */}
                            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <h2 class="text-lg font-semibold text-gray-700 mb-4">按模型成本分布</h2>
                                <div class="h-80">
                                    {modelCostChartData().labels.length > 1 ||
                                    (modelCostChartData().labels.length === 1 && modelCostChartData().datasets[0].data[0] > 0) ? (
                                        <Chart
                                            type="doughnut"
                                            data={modelCostChartData()}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { position: "right" as const },
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
                                            }}
                                        />
                                    ) : (
                                        <div class="flex items-center justify-center h-full text-gray-500">暂无模型成本数据</div>
                                    )}
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
                                            {systemCostTable().length > 0 ? (
                                                <For each={systemCostTable()}>
                                                    {(item) => (
                                                        <tr class="border-b border-gray-100">
                                                            <td class="px-4 py-2 text-gray-900">{item.system}</td>
                                                            <td class="px-4 py-2 text-right text-gray-900">${item.cost.toFixed(6)}</td>
                                                            <td class="px-4 py-2 text-right text-gray-600">{item.runs.toLocaleString()}</td>
                                                            <td class="px-4 py-2 text-right text-gray-600">${item.avgCostPerRun.toFixed(8)}</td>
                                                        </tr>
                                                    )}
                                                </For>
                                            ) : (
                                                <tr>
                                                    <td colspan="4" class="px-4 py-8 text-center text-gray-500">暂无系统成本数据</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnifiedDashboard;
