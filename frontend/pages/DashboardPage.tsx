import { createSignal, createResource, type JSX } from "solid-js";
import {
    getSummary,
    type SummaryQuery,
    type SummaryResponse,
} from "../api";
import { TrendingUp, TrendingDown, Users, Activity, Clock, DollarSign, Zap, Database } from "lucide-solid";

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

interface FilterState {
    startTime: Date;
    endTime: Date;
}

const timeRanges = [
    { label: "最近7天", value: "7d" },
    { label: "最近14天", value: "14d" },
    { label: "最近30天", value: "30d" },
    { label: "最近90天", value: "90d" },
];

const StatCard = (props: {
    title: string;
    value: string | number;
    icon: JSX.Element;
    trend?: number;
    format?: "number" | "percentage" | "duration" | "tokens";
    color?: "blue" | "green" | "purple" | "orange";
}) => {
    const colorClasses = {
        blue: "bg-blue-50 border-blue-200",
        green: "bg-green-50 border-green-200",
        purple: "bg-purple-50 border-purple-200",
        orange: "bg-orange-50 border-orange-200",
    };

    const formatValue = (value: number): string => {
        switch (props.format) {
            case "percentage":
                return `${value.toFixed(2)}%`;
            case "duration":
                return `${(value / 1000).toFixed(2)}s`;
            case "tokens":
                return `${(value / 1000).toFixed(1)}k`;
            default:
                return Math.round(value).toLocaleString();
        }
    };

    return (
        <div class={`border ${colorClasses[props.color || "blue"]} rounded-lg shadow-sm p-4`}>
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <div class="text-xs text-gray-500 mb-1">{props.title}</div>
                    <div class="text-2xl font-bold text-gray-900">
                        {formatValue(Number(props.value))}
                    </div>
                    {props.trend !== undefined && (
                        <div class="flex items-center gap-1 mt-2">
                            {props.trend > 0 ? (
                                <TrendingUp size={14} class="text-green-600" />
                            ) : (
                                <TrendingDown size={14} class="text-red-600" />
                            )}
                            <span
                                class={`text-xs font-medium ${
                                    props.trend > 0 ? "text-green-600" : "text-red-600"
                                }`}
                            >
                                {Math.abs(props.trend).toFixed(2)}%
                            </span>
                        </div>
                    )}
                </div>
                <div class="text-gray-400">{props.icon}</div>
            </div>
        </div>
    );
};

const PerformanceCard = (props: {
    title: string;
    metrics: Record<string, number>;
    format?: "duration" | "tokens";
}) => {
    const formatValue = (value: number, format?: string): string => {
        if (format === "duration") {
            return `${(value / 1000).toFixed(2)}s`;
        } else if (format === "tokens") {
            return `${(value / 1000).toFixed(1)}k`;
        }
        return value.toFixed(2);
    };

    return (
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h3 class="text-sm font-semibold text-gray-700 mb-3">{props.title}</h3>
            <div class="grid grid-cols-3 gap-4">
                <div>
                    <div class="text-xs text-gray-500 mb-1">平均</div>
                    <div class="text-lg font-bold text-gray-900">
                        {formatValue(
                            Object.values(props.metrics)[0],
                            props.format,
                        )}
                    </div>
                </div>
                <div>
                    <div class="text-xs text-gray-500 mb-1">P95</div>
                    <div class="text-lg font-bold text-gray-900">
                        {formatValue(
                            Object.values(props.metrics)[1],
                            props.format,
                        )}
                    </div>
                </div>
                <div>
                    <div class="text-xs text-gray-500 mb-1">P99</div>
                    <div class="text-lg font-bold text-gray-900">
                        {formatValue(
                            Object.values(props.metrics)[2],
                            props.format,
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const TopModelRow = (props: {
    model: SummaryResponse["data"]["top_models"][0];
    index: number;
}) => {
    const colors = [
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-orange-500",
        "bg-pink-500",
    ];

    return (
        <tr class="border-b border-gray-100 last:border-0">
            <td class="px-4 py-3">
                <span
                    class={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${
                        colors[props.index % colors.length]
                    }`}
                >
                    {props.index + 1}
                </span>
            </td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900">
                {props.model.model_name}
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
                {props.model.runs.toLocaleString()}
            </td>
            <td class="px-4 py-3 text-sm text-gray-600">
                {(props.model.avg_duration_ms / 1000).toFixed(2)}s
            </td>
            <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                    <div class="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                            class="bg-blue-500 h-2 rounded-full"
                            style={`width: ${Math.min(
                                (props.model.avg_duration_ms / 10000) * 100,
                                100,
                            )}%`}
                        ></div>
                    </div>
                </div>
            </td>
        </tr>
    );
};

const DashboardPage = (): JSX.Element => {
    const [filters, setFilters] = createSignal<FilterState>({
        startTime: sevenDaysAgo(),
        endTime: todayEnd(),
    });

    const [selectedTimeRange, setSelectedTimeRange] = createSignal<string>("7d");

    const [summaryData] = createResource(
        filters,
        async (currentFilters) => {
            try {
                const query: SummaryQuery = {
                    start_time: currentFilters.startTime.toISOString(),
                    end_time: currentFilters.endTime.toISOString(),
                };

                const response = await getSummary(query);
                return response;
            } catch (err) {
                console.error("Failed to fetch summary data", err);
                return {
                    success: false,
                    data: {
                        runs: {
                            total: 0,
                            successful: 0,
                            failed: 0,
                            success_rate: 0,
                        },
                        performance: {
                            avg_duration_ms: 0,
                            p95_duration_ms: 0,
                            p99_duration_ms: 0,
                            avg_ttft_ms: 0,
                        },
                        tokens: {
                            total: 0,
                            avg_per_run: 0,
                        },
                        users: {
                            distinct: 0,
                        },
                        top_models: [],
                    },
                } as SummaryResponse;
            }
        },
    );

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
            case "90d":
                startTime.setDate(startTime.getDate() - 90);
                break;
        }
        setFilters((prev) => ({ ...prev, startTime, endTime }));
    };

    return (
        <div class="bg-gray-50 min-h-screen">
            {/* Fixed Header */}
            <div class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <div class="p-4">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <Database class="text-blue-600" size={24} />
                            <h1 class="text-2xl font-bold text-gray-800">数据仪表板</h1>
                        </div>

                        {/* Time Range Selector */}
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
                    </div>
                </div>
            </div>

            {/* Content */}
            <div class="p-4 space-y-4">
                {summaryData.loading ? (
                    <div class="text-center py-12 text-gray-500">
                        加载数据中...
                    </div>
                ) : summaryData()?.success ? (
                    <>
                        {/* Stats Cards */}
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="总运行次数"
                                value={summaryData()?.data?.runs?.total || 0}
                                icon={<Activity size={20} />}
                                color="blue"
                            />
                            <StatCard
                                title="成功率"
                                value={summaryData()?.data?.runs?.success_rate || 0}
                                icon={<Zap size={20} />}
                                color="green"
                                format="percentage"
                            />
                            <StatCard
                                title="总 Token 数"
                                value={summaryData()?.data?.tokens?.total || 0}
                                icon={<Database size={20} />}
                                color="purple"
                                format="tokens"
                            />
                            <StatCard
                                title="独立用户数"
                                value={summaryData()?.data?.users?.distinct || 0}
                                icon={<Users size={20} />}
                                color="orange"
                            />
                        </div>

                        {/* Performance Cards */}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <PerformanceCard
                                title="延迟分析"
                                metrics={{
                                    avg: summaryData()?.data?.performance?.avg_duration_ms || 0,
                                    p95: summaryData()?.data?.performance?.p95_duration_ms || 0,
                                    p99: summaryData()?.data?.performance?.p99_duration_ms || 0,
                                }}
                                format="duration"
                            />
                            <PerformanceCard
                                title="首包时间分析"
                                metrics={{
                                    avg: summaryData()?.data?.performance?.avg_ttft_ms || 0,
                                    p95: 0,
                                    p99: 0,
                                }}
                                format="duration"
                            />
                        </div>

                        {/* Run Statistics */}
                        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                            <h3 class="text-sm font-semibold text-gray-700 mb-3">
                                运行统计
                            </h3>
                            <div class="grid grid-cols-3 gap-4">
                                <div>
                                    <div class="text-xs text-gray-500 mb-1">成功运行</div>
                                    <div class="text-xl font-bold text-green-600">
                                        {summaryData()?.data?.runs?.successful.toLocaleString() ||
                                            0}
                                    </div>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-500 mb-1">失败运行</div>
                                    <div class="text-xl font-bold text-red-600">
                                        {summaryData()?.data?.runs?.failed.toLocaleString() ||
                                            0}
                                    </div>
                                </div>
                                <div>
                                    <div class="text-xs text-gray-500 mb-1">
                                        平均 Token 数
                                    </div>
                                    <div class="text-xl font-bold text-gray-900">
                                        {summaryData()?.data?.tokens?.avg_per_run
                                            ? Math.round(
                                                  summaryData()?.data?.tokens
                                                      ?.avg_per_run,
                                              ).toLocaleString()
                                            : 0}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Models */}
                        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                            <h3 class="text-sm font-semibold text-gray-700 mb-3">
                                热门模型
                            </h3>
                            {summaryData()?.data?.top_models?.length > 0 ? (
                                <table class="w-full">
                                    <thead>
                                        <tr class="border-b border-gray-200">
                                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                排名
                                            </th>
                                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                模型名称
                                            </th>
                                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                运行次数
                                            </th>
                                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                平均延迟
                                            </th>
                                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                                性能对比
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={summaryData()?.data?.top_models || []}>
                                            {(model, index) => (
                                                <TopModelRow
                                                    model={model}
                                                    index={index()}
                                                />
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            ) : (
                                <div class="text-center py-8 text-gray-500">
                                    暂无模型数据
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div class="text-center py-12 text-red-500">
                        加载数据失败
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;
