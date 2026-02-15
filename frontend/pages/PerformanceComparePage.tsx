import { createSignal, createResource, For, type JSX, createMemo } from "solid-js";
import {
    getComparison,
    type CompareQuery,
    type CompareResponse,
    getTimeseries,
    type TimeseriesQuery,
    type TimeseriesResponse,
} from "../api";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-solid";
import { BarChart } from "../components/analytics/BarChart";
import { MultiLineChart } from "../components/analytics/MultiLineChart";

const sevenDaysAgo = (): Date => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
};

const todayEnd = (): Date => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
};

const getPreviousPeriod = (start: Date, end: Date): { start: Date; end: Date } => {
    const duration = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start: prevStart, end: prevEnd };
};

interface FilterState {
    startTime: Date;
    endTime: Date;
    compareBy: CompareQuery["compare_by"];
    metrics: string[];
}

const timeRanges = [
    { label: "最近7天", value: "7d" },
    { label: "最近14天", value: "14d" },
    { label: "最近30天", value: "30d" },
];

const compareOptions: { label: string; value: CompareQuery["compare_by"] }[] = [
    { label: "按模型对比", value: "model" },
    { label: "按系统对比", value: "system" },
    { label: "按时间段对比", value: "time_period" },
];

const availableMetrics: { label: string; value: string }[] = [
    { label: "平均延迟", value: "avg_duration_ms" },
    { label: "P95 延迟", value: "p95_duration_ms" },
    { label: "P99 延迟", value: "p99_duration_ms" },
    { label: "错误率", value: "error_rate" },
    { label: "平均 Token 数", value: "avg_tokens_per_run" },
    { label: "平均首包时间", value: "avg_ttft_ms" },
];

const formatValue = (value: number, metric: string): string => {
    if (metric === "error_rate") {
        return (value * 100).toFixed(2) + "%";
    } else if (metric.includes("duration_ms") || metric.includes("ttft_ms")) {
        return (value / 1000).toFixed(2) + "s";
    } else if (metric.includes("tokens")) {
        return (value / 1000).toFixed(1) + "k";
    }
    return Math.round(value).toLocaleString();
};

const ComparisonCard = (props: {
    dimension: Record<string, string>;
    period1: Record<string, number>;
    period2: Record<string, number>;
    diff: Record<string, number>;
    metrics: string[];
}) => {
    const diffColor = (value: number, metric: string) => {
        if (metric === "error_rate") {
            return value > 0 ? "text-red-600" : "text-green-600";
        }
        return value > 0 ? "text-green-600" : "text-red-600";
    };

    const getDimensionLabel = () => {
        if (props.dimension.model_name) return props.dimension.model_name;
        if (props.dimension.system) return props.dimension.system;
        if (props.dimension.time_period) return props.dimension.time_period;
        return "Unknown";
    };

    return (
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h3 class="text-sm font-semibold text-gray-700 mb-3">
                {getDimensionLabel()}
            </h3>

            <div class="space-y-3">
                <For each={props.metrics}>
                    {(metric) => (
                        <div class="border-t border-gray-100 pt-2">
                            <div class="text-xs text-gray-500 mb-1">{availableMetrics.find(m => m.value === metric)?.label || metric}</div>
                            <div class="flex justify-between items-center">
                                <div class="text-sm text-gray-900">
                                    {formatValue(props.period1[metric] || 0, metric)}
                                </div>
                                <div
                                    class={`flex items-center gap-1 text-xs font-medium ${
                                        diffColor(props.diff[metric] || 0, metric)
                                    }`}
                                >
                                    {props.diff[metric] > 0 ? (
                                        <TrendingUp size={14} />
                                    ) : (
                                        <TrendingDown size={14} />
                                    )}
                                    <span>
                                        {Math.abs(props.diff[metric] || 0) > 0
                                            ? formatValue(Math.abs(props.diff[metric] || 0), metric)
                                            : "无变化"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

const PerformanceComparePage = (): JSX.Element => {
    const [filters, setFilters] = createSignal<FilterState>({
        startTime: sevenDaysAgo(),
        endTime: todayEnd(),
        compareBy: "model",
        metrics: ["avg_duration_ms", "error_rate"],
    });

    const [selectedTimeRange, setSelectedTimeRange] = createSignal<string>("7d");

    // 对比数据
    const [comparisonData] = createResource(
        filters,
        async (currentFilters) => {
            try {
                const previousPeriod = getPreviousPeriod(
                    currentFilters.startTime,
                    currentFilters.endTime,
                );

                const query: CompareQuery = {
                    compare_by: currentFilters.compareBy,
                    metrics: currentFilters.metrics,
                    start_time_1: currentFilters.startTime.toISOString(),
                    end_time_1: currentFilters.endTime.toISOString(),
                    start_time_2: previousPeriod.start.toISOString(),
                    end_time_2: previousPeriod.end.toISOString(),
                };

                const response = await getComparison(query);
                return response;
            } catch (err) {
                console.error("Failed to fetch comparison data", err);
                return { success: false, data: [] } as CompareResponse;
            }
        },
    );

    // 趋势数据（用于图表展示）
    const [timeseriesData] = createResource(
        filters,
        async (currentFilters) => {
            try {
                const query: TimeseriesQuery = {
                    dimension: currentFilters.compareBy === "model" ? "model_name" : "system",
                    metrics: currentFilters.metrics,
                    granularity: "1d",
                    start_time: currentFilters.startTime.toISOString(),
                    end_time: currentFilters.endTime.toISOString(),
                    limit: 100,
                };

                const response = await getTimeseries(query);
                return response;
            } catch (err) {
                console.error("Failed to fetch timeseries data", err);
                return { success: false, data: [], meta: { total: 0, limit: 100, offset: 0 } };
            }
        },
    );

    // 转换趋势数据为多线图表格式
    const chartSeries = createMemo(() => {
        const data = timeseriesData()?.data || [];
        if (data.length === 0) return [];

        const seriesByDimension = new Map<string, Array<{ time: string; value: number }>>();

        data.forEach((item) => {
            const dimensionKey = item.dimensions?.[filters().compareBy === "model" ? "model_name" : "system"] || "Unknown";
            const value = item.metrics[filters().metrics[0]] || 0;

            if (!seriesByDimension.has(dimensionKey)) {
                seriesByDimension.set(dimensionKey, []);
            }

            seriesByDimension.get(dimensionKey)!.push({
                time: item.time,
                value,
            });
        });

        const colorPalette = [
            "rgb(75, 192, 192)",
            "rgb(255, 99, 132)",
            "rgb(53, 162, 235)",
            "rgb(255, 206, 86)",
            "rgb(153, 102, 255)",
            "rgb(255, 159, 64)",
        ];

        let index = 0;
        const result: Array<{ label: string; data: Array<{ time: string; value: number }>; color?: string }> = [];

        seriesByDimension.forEach((data, label) => {
            result.push({
                label,
                data: data.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
                color: colorPalette[index % colorPalette.length],
            });
            index++;
        });

        return result;
    });

    // 转换对比数据为柱状图格式
    const barChartData = createMemo(() => {
        const data = comparisonData()?.data || [];
        const metric = filters().metrics[0];

        return data.map((item) => ({
            label: item.dimension.model_name || item.dimension.system || item.dimension.time_period || "Unknown",
            value: item.diff[metric] || 0,
            color: (item.diff[metric] || 0) > 0
                ? metric === "error_rate"
                    ? "rgb(239, 68, 68)"
                    : "rgb(34, 197, 94)"
                : metric === "error_rate"
                ? "rgb(34, 197, 94)"
                : "rgb(239, 68, 68)",
        }));
    });

    const handleTimeRangeChange = (range: string) => {
        setSelectedTimeRange(range);
        const endTime = new Date();
        const startTime = new Date();
        switch (range) {
            case "7d":
                startTime.setDate(startTime.getDate() - 7);
                break;
            case "14d":
                startTime.setDate(startTime.getDate() - 14);
                break;
            case "30d":
                startTime.setDate(startTime.getDate() - 30);
                break;
        }
        setFilters((prev) => ({ ...prev, startTime, endTime }));
    };

    const handleCompareByChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        setFilters((prev) => ({ ...prev, compareBy: target.value as CompareQuery["compare_by"] }));
    };

    const handleMetricToggle = (metric: string) => {
        setFilters((prev) => {
            const currentMetrics = prev.metrics;
            if (currentMetrics.includes(metric)) {
                if (currentMetrics.length > 1) {
                    return { ...prev, metrics: currentMetrics.filter((m) => m !== metric) };
                }
            } else {
                if (currentMetrics.length < 4) {
                    return { ...prev, metrics: [...currentMetrics, metric] };
                }
            }
            return prev;
        });
    };

    return (
        <div class="bg-gray-50 min-h-screen">
            {/* Fixed Header */}
            <div class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <div class="p-4">
                    <div class="flex items-center gap-3 mb-4">
                        <BarChart3 class="text-blue-600" size={24} />
                        <h1 class="text-2xl font-bold text-gray-800">
                            性能对比分析
                        </h1>
                    </div>

                    {/* Filter Section */}
                    <div class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div class="flex flex-wrap gap-3 items-center">
                            {/* 时间范围 */}
                            <div class="flex items-center gap-2">
                                <For each={timeRanges}>
                                    {(range) => (
                                        <button
                                            class={`px-3 py-1.5 rounded border text-sm ${
                                                selectedTimeRange() === range.value
                                                    ? "bg-blue-500 text-white border-blue-500"
                                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                                            }`}
                                            onClick={() => handleTimeRangeChange(range.value)}
                                        >
                                            {range.label}
                                        </button>
                                    )}
                                </For>
                            </div>

                            {/* 对比维度 */}
                            <select
                                class="px-3 py-1.5 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                                onChange={handleCompareByChange}
                                value={filters().compareBy}
                            >
                                <For each={compareOptions}>
                                    {(option) => (
                                        <option value={option.value}>{option.label}</option>
                                    )}
                                </For>
                            </select>

                            {/* 指标选择 */}
                            <div class="flex items-center gap-2">
                                <span class="text-sm text-gray-600">指标:</span>
                                <For each={availableMetrics}>
                                    {(metric) => (
                                        <button
                                            class={`px-2 py-1 rounded border text-xs ${
                                                filters().metrics.includes(metric.value)
                                                    ? "bg-blue-500 text-white border-blue-500"
                                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                                            }`}
                                            onClick={() => handleMetricToggle(metric.value)}
                                        >
                                            {metric.label}
                                        </button>
                                    )}
                                </For>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div class="p-4 space-y-4">
                {/* 对比卡片 */}
                <div>
                    <h2 class="text-lg font-semibold text-gray-700 mb-3">详细对比</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {comparisonData.loading ? (
                            <div class="col-span-full text-center py-8 text-gray-500">
                                加载对比数据中...
                            </div>
                        ) : comparisonData()?.data?.length ? (
                            <For each={comparisonData()?.data || []}>
                                {(item) => (
                                    <ComparisonCard
                                        dimension={item.dimension}
                                        period1={item.period_1}
                                        period2={item.period_2}
                                        diff={item.diff}
                                        metrics={filters().metrics}
                                    />
                                )}
                            </For>
                        ) : (
                            <div class="col-span-full text-center py-8 text-gray-500">
                                没有对比数据
                            </div>
                        )}
                    </div>
                </div>

                {/* 趋势图表 */}
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 多线趋势图 */}
                    <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                        <h2 class="text-lg font-semibold text-gray-700 mb-3">
                            趋势对比
                        </h2>
                        {timeseriesData.loading ? (
                            <div class="text-center py-8 text-gray-500">加载趋势数据中...</div>
                        ) : chartSeries().length ? (
                            <MultiLineChart
                                series={chartSeries()}
                                height={300}
                                showPoints={true}
                                smoothLine={true}
                            />
                        ) : (
                            <div class="text-center py-8 text-gray-500">没有趋势数据</div>
                        )}
                    </div>

                    {/* 差异柱状图 */}
                    <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                        <h2 class="text-lg font-semibold text-gray-700 mb-3">
                            {availableMetrics.find(m => m.value === filters().metrics[0])?.label || "差异分析"}
                        </h2>
                        {comparisonData.loading ? (
                            <div class="text-center py-8 text-gray-500">加载差异数据中...</div>
                        ) : barChartData().length ? (
                            <BarChart data={barChartData()} horizontal={true} height={300} />
                        ) : (
                            <div class="text-center py-8 text-gray-500">没有差异数据</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerformanceComparePage;
