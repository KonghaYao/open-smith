import { createSignal, createResource, For, type JSX, createMemo } from "solid-js";
import {
    getTrends,
    type TrendQuery,
    type TrendResponse,
} from "../api";
import { TrendingUp, TrendingDown, Activity } from "lucide-solid";

const threeDaysAgo = (): Date => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d;
};

const todayEnd = (): Date => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
};

interface FilterState {
    startTime: Date;
    endTime: Date;
    metric: TrendQuery["metric"];
    period: TrendQuery["period"];
}

const timeRanges = [
    { label: "最近3天", value: "3d" },
    { label: "最近7天", value: "7d" },
    { label: "最近30天", value: "30d" },
];

const metrics: { label: string; value: TrendQuery["metric"] }[] = [
    { label: "总运行次数", value: "total_runs" },
    { label: "成功次数", value: "successful_runs" },
    { label: "失败次数", value: "failed_runs" },
    { label: "错误率", value: "error_rate" },
    { label: "平均延迟 (ms)", value: "avg_duration_ms" },
    { label: "P95 延迟 (ms)", value: "p95_duration_ms" },
    { label: "P99 延迟 (ms)", value: "p99_duration_ms" },
    { label: "总 Token 数", value: "total_tokens" },
    { label: "平均 Token 数", value: "avg_tokens_per_run" },
    { label: "平均首包时间 (ms)", value: "avg_ttft_ms" },
    { label: "独立用户数", value: "distinct_users" },
];

const periods: { label: string; value: TrendQuery["period"] }[] = [
    { label: "日环比 (DoD)", value: "dod" },
    { label: "周环比 (WoW)", value: "wow" },
    { label: "月环比 (MoM)", value: "mom" },
];

const TrendCard = (props: {
    metric: { label: string; value: TrendQuery["metric"] };
    data: TrendResponse | undefined;
    loading: boolean;
}) => {
    const formatValue = (value: number, metric: TrendQuery["metric"]): string => {
        if (
            metric === "error_rate" ||
            metric.includes("duration_ms") ||
            metric.includes("ttft_ms")
        ) {
            return value.toFixed(2);
        } else if (metric.includes("tokens")) {
            return (value / 1000).toFixed(1) + "k";
        }
        return Math.round(value).toLocaleString();
    };

    const metricLabel = (metric: TrendQuery["metric"]): string => {
        if (metric.includes("duration_ms")) return "ms";
        if (metric.includes("ttft_ms")) return "ms";
        if (metric.includes("tokens")) return "tokens";
        if (metric === "error_rate") return "%";
        return "";
    };

    return (
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h3 class="text-sm font-medium text-gray-600 mb-4">{props.metric.label}</h3>

            {props.loading ? (
                <div class="text-center py-8 text-gray-500">加载中...</div>
            ) : props.data?.success ? (
                <div class="space-y-4">
                    {/* 当前值 */}
                    <div>
                        <div class="text-xs text-gray-500 mb-1">
                            当前 ({props.data.data.current.period})
                        </div>
                        <div class="text-2xl font-bold text-gray-900">
                            {formatValue(
                                props.data.data.current.value,
                                props.metric.value,
                            )}
                            <span class="text-sm text-gray-500 ml-1">
                                {metricLabel(props.metric.value)}
                            </span>
                        </div>
                    </div>

                    {/* 对比值 */}
                    <div>
                        <div class="text-xs text-gray-500 mb-1">
                            对比 ({props.data.data.previous.period})
                        </div>
                        <div class="text-lg font-medium text-gray-700">
                            {formatValue(
                                props.data.data.previous.value,
                                props.metric.value,
                            )}
                            <span class="text-xs text-gray-500 ml-1">
                                {metricLabel(props.metric.value)}
                            </span>
                        </div>
                    </div>

                    {/* 趋势 */}
                    <div
                        class={`flex items-center gap-2 ${
                            props.data.data.trend.direction === "up"
                                ? props.metric.value === "failed_runs" ||
                                  props.metric.value === "error_rate"
                                    ? "text-red-600"
                                    : "text-green-600"
                                : props.metric.value === "failed_runs" ||
                                  props.metric.value === "error_rate"
                                ? "text-green-600"
                                : "text-red-600"
                        }`}
                    >
                        {props.data.data.trend.direction === "up" ? (
                            <TrendingUp size={16} />
                        ) : (
                            <TrendingDown size={16} />
                        )}
                        <div>
                            <span class="text-xs">
                                {Math.abs(props.data.data.trend.percentage).toFixed(
                                    2,
                                )}
                                %
                            </span>
                            <span class="text-xs ml-1">
                                {props.data.data.trend.direction === "up"
                                    ? "上升"
                                    : "下降"}
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                <div class="text-center py-8 text-red-500">加载失败</div>
            )}
        </div>
    );
};

const TrendComparisonPage = (): JSX.Element => {
    const [filters, setFilters] = createSignal<FilterState>({
        startTime: threeDaysAgo(),
        endTime: todayEnd(),
        metric: "total_runs",
        period: "dod",
    });

    const [selectedTimeRange, setSelectedTimeRange] = createSignal<string>("3d");

    // 为所有指标创建资源
    const createTrendResources = () => {
        const resources: {
            metric: TrendQuery["metric"];
            resource: ReturnType<typeof createResource<TrendResponse>>;
        }[] = [];

        for (const metric of metrics) {
            const resource = createResource(
                () => filters().metric === metric.value,
                async (shouldFetch) => {
                    if (!shouldFetch) return { success: false, data: null as any };
                    try {
                        const query: TrendQuery = {
                            metric: metric.value,
                            period: filters().period,
                            start_time: filters().startTime.toISOString(),
                            end_time: filters().endTime.toISOString(),
                        };
                        return await getTrends(query);
                    } catch (err) {
                        console.error(`Failed to fetch trends for ${metric.value}`, err);
                        return { success: false, data: null as any };
                    }
                },
            );
            resources.push({ metric: metric.value, resource });
        }

        return resources;
    };

    const trendResources = createMemo(createTrendResources);

    const handleTimeRangeChange = (range: string) => {
        setSelectedTimeRange(range);
        const endTime = new Date();
        const startTime = new Date();
        switch (range) {
            case "3d":
                startTime.setDate(startTime.getDate() - 3);
                break;
            case "7d":
                startTime.setDate(startTime.getDate() - 7);
                break;
            case "30d":
                startTime.setDate(startTime.getDate() - 30);
                break;
        }
        setFilters((prev) => ({ ...prev, startTime, endTime }));
    };

    const handleMetricChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        setFilters((prev) => ({ ...prev, metric: target.value as TrendQuery["metric"] }));
    };

    const handlePeriodChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        setFilters((prev) => ({ ...prev, period: target.value as TrendQuery["period"] }));
    };

    return (
        <div class="bg-gray-50 min-h-screen">
            {/* Fixed Header */}
            <div class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <div class="p-4">
                    <div class="flex items-center gap-3 mb-4">
                        <Activity class="text-blue-600" size={24} />
                        <h1 class="text-2xl font-bold text-gray-800">
                            趋势对比分析
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

                            {/* 对比周期 */}
                            <select
                                class="px-3 py-1.5 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                                onChange={handlePeriodChange}
                                value={filters().period}
                            >
                                <For each={periods}>
                                    {(period) => (
                                        <option value={period.value}>{period.label}</option>
                                    )}
                                </For>
                            </select>

                            {/* 指标选择 */}
                            <select
                                class="px-3 py-1.5 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                                onChange={handleMetricChange}
                                value={filters().metric}
                            >
                                <For each={metrics}>
                                    {(metric) => (
                                        <option value={metric.value}>
                                            {metric.label}
                                        </option>
                                    )}
                                </For>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div class="p-4">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <For each={metrics}>
                        {(metric) => {
                            const resourceItem = trendResources().find(
                                (r) => r.metric === metric.value,
                            );
                            if (!resourceItem) return null;

                            return (
                                <TrendCard
                                    metric={metric}
                                    data={resourceItem.resource()}
                                    loading={resourceItem.resource.loading}
                                />
                            );
                        }}
                    </For>
                </div>
            </div>
        </div>
    );
};

export default TrendComparisonPage;
