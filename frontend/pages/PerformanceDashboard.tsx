import {
    createSignal,
    createResource,
    For,
    type JSX,
    createMemo,
} from "solid-js";
import { getTimeseries, getSummary, type TimeseriesQuery, type SummaryResponse } from "../api.js";
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
} from "lucide-solid";

const timeRanges = [
    { label: "最近15分钟", value: "15m", granularity: "5min" as const },
    { label: "最近1小时", value: "1h", granularity: "15min" as const },
    { label: "最近3小时", value: "3h", granularity: "30min" as const },
    { label: "最近12小时", value: "12h", granularity: "1h" as const },
    { label: "最近1天", value: "1d", granularity: "1h" as const },
    { label: "最近7天", value: "7d", granularity: "1d" as const },
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
        case "7d":
            d.setDate(d.getDate() - 7);
            break;
    }
    return d;
};

// 性能健康度评分组件
const HealthScore = (props: { score: number; trend?: "up" | "down" | "stable" }): JSX.Element => {
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

const PerformanceDashboard = (): JSX.Element => {
    const [selectedTimeRange, setSelectedTimeRange] = createSignal("1h");
    const [refreshKey, setRefreshKey] = createSignal(0);

    // 实时性能数据
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

                const response = await getTimeseries(query);
                return response;
            } catch (err) {
                console.error("Failed to fetch performance data", err);
                return { success: false, data: [], meta: { total: 0, limit: 1000, offset: 0 } };
            }
        },
    );

    // 汇总数据
    const [summaryData] = createResource(
        () => ({ timeRange: selectedTimeRange(), key: refreshKey() }),
        async ({ timeRange }) => {
            try {
                const startTime = getStartTime(timeRange);
                const response = await getSummary({
                    start_time: startTime.toISOString(),
                    end_time: new Date().toISOString(),
                });
                return response;
            } catch (err) {
                console.error("Failed to fetch summary data", err);
                return { success: false, data: null };
            }
        },
    );

    // 计算健康度评分
    const healthScore = createMemo(() => {
        const summary = summaryData()?.data;
        if (!summary) return 0;

        // 基于多个指标计算健康度
        const successRateScore = summary.runs?.success_rate || 0;
        const performanceScore = summary.performance?.avg_duration_ms
            ? Math.max(0, 100 - (summary.performance.avg_duration_ms / 5000) * 100)
            : 100;
        const tokenScore = summary.tokens?.avg_per_run
            ? Math.max(0, 100 - (summary.tokens.avg_per_run / 10000) * 20)
            : 100;

        return Math.round((successRateScore * 0.5 + performanceScore * 0.3 + tokenScore * 0.2));
    });

    // 合并重复时间点的数据（取非空值，优先取最新）
    const mergedPerformanceData = createMemo(() => {
        const rawData = performanceData()?.data || [];
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

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
    };

    return (
        <div class="bg-gray-50 min-h-screen">
            {/* Header */}
            <div class="sticky top-0 z-10 bg-white border-b border-gray-200">
                <div class="p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h1 class="text-2xl font-bold text-gray-800">性能监控仪表板</h1>
                            <p class="text-sm text-gray-500 mt-1">实时监控系统运行状态和性能指标</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <HealthScore score={healthScore()} />
                            <button
                                onClick={handleRefresh}
                                class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                                <Refresh class="w-4 h-4 mr-1.5" />
                                刷新
                            </button>
                        </div>
                    </div>

                    {/* Time Range Selector */}
                    <div class="flex gap-2 mt-4">
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
                {/* Key Metrics */}
                {summaryData()?.data && (
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
                )}

                {/* Performance Data Table */}
                <div class="bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div class="p-4 border-b border-gray-200">
                        <h2 class="text-lg font-semibold text-gray-700">性能数据详情</h2>
                        <p class="text-sm text-gray-500 mt-1">按时间统计的性能指标</p>
                    </div>
                    <div class="overflow-x-auto">
                        {mergedPerformanceData().length > 0 ? (
                            <table class="w-full text-sm">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">时间</th>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">总运行次数</th>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">成功/失败</th>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">错误率</th>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">平均延迟 (s)</th>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">P95 延迟 (s)</th>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">P99 延迟 (s)</th>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">平均首包 (s)</th>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">P95 首包 (s)</th>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">Token 总数</th>
                                        <th class="px-4 py-3 text-left font-medium text-gray-700">独立用户</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-200">
                                    <For each={mergedPerformanceData()}>
                                        {(item) => (
                                            <tr class="hover:bg-gray-50">
                                                <td class="px-4 py-3 text-gray-900 whitespace-nowrap">
                                                    {new Date(item.time).toLocaleString()}
                                                </td>
                                                <td class="px-4 py-3 text-gray-900">
                                                    {(item.metrics.total_runs || 0).toLocaleString()}
                                                </td>
                                                <td class="px-4 py-3 text-gray-600">
                                                    {(item.metrics.successful_runs || 0).toLocaleString()} / {(item.metrics.failed_runs || 0).toLocaleString()}
                                                </td>
                                                <td class="px-4 py-3 text-gray-900">
                                                    {item.metrics.error_rate !== null && item.metrics.error_rate !== undefined
                                                        ? `${(item.metrics.error_rate * 100).toFixed(2)}%`
                                                        : "N/A"}
                                                </td>
                                                <td class="px-4 py-3 text-gray-900">
                                                    {item.metrics.avg_duration_ms !== null && item.metrics.avg_duration_ms !== undefined
                                                        ? `${(item.metrics.avg_duration_ms / 1000).toFixed(2)}`
                                                        : "N/A"}
                                                </td>
                                                <td class="px-4 py-3 text-gray-900">
                                                    {item.metrics.p95_duration_ms !== null && item.metrics.p95_duration_ms !== undefined
                                                        ? `${(item.metrics.p95_duration_ms / 1000).toFixed(2)}`
                                                        : "N/A"}
                                                </td>
                                                <td class="px-4 py-3 text-gray-900">
                                                    {item.metrics.p99_duration_ms !== null && item.metrics.p99_duration_ms !== undefined
                                                        ? `${(item.metrics.p99_duration_ms / 1000).toFixed(2)}`
                                                        : "N/A"}
                                                </td>
                                                <td class="px-4 py-3 text-gray-900">
                                                    {item.metrics.avg_ttft_ms !== null && item.metrics.avg_ttft_ms !== undefined
                                                        ? `${(item.metrics.avg_ttft_ms / 1000).toFixed(2)}`
                                                        : "N/A"}
                                                </td>
                                                <td class="px-4 py-3 text-gray-900">
                                                    {item.metrics.p95_ttft_ms !== null && item.metrics.p95_ttft_ms !== undefined
                                                        ? `${(item.metrics.p95_ttft_ms / 1000).toFixed(2)}`
                                                        : "N/A"}
                                                </td>
                                                <td class="px-4 py-3 text-gray-900">
                                                    {(item.metrics.total_tokens_sum || 0).toLocaleString()}
                                                </td>
                                                <td class="px-4 py-3 text-gray-900">
                                                    {(item.metrics.distinct_users || 0).toLocaleString()}
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        ) : (
                            <div class="p-8 text-center text-gray-500">
                                <Activity class="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                <p>暂无性能数据</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Performance Alerts */}
                {mergedPerformanceData().length > 0 && (
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
                                                <p class="text-sm font-medium text-red-800">
                                                    高错误率警告
                                                </p>
                                                <p class="text-xs text-red-600">
                                                    当前错误率 {((lastDataPoint.metrics.error_rate || 0) * 100).toFixed(2)}%
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }

                                if ((lastDataPoint?.metrics.avg_duration_ms || 0) > 5000) {
                                    alerts.push(
                                        <div class="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <AlertTriangle class="w-5 h-5 text-yellow-600 mr-3" />
                                            <div class="flex-1">
                                                <p class="text-sm font-medium text-yellow-800">
                                                    高延迟警告
                                                </p>
                                                <p class="text-xs text-yellow-600">
                                                    平均延迟 {((lastDataPoint.metrics.avg_duration_ms || 0) / 1000).toFixed(2)}s
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }

                                return alerts.length > 0 ? alerts : (
                                    <div class="text-center py-8 text-gray-500">
                                        <Activity class="mx-auto h-8 w-8 text-green-500 mb-2" />
                                        <p class="text-sm">系统运行正常，未检测到异常</p>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PerformanceDashboard;
