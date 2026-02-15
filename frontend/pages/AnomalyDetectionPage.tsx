import { createSignal, createResource, For, type JSX, createMemo } from "solid-js";
import {
    getAnomalies,
    type AnomalyQuery,
    type AnomalyResponse,
} from "../api";
import { AlertTriangle, Activity, Info } from "lucide-solid";
import { AnomalyChart } from "../components/analytics/AnomalyChart";

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
    metric: AnomalyQuery["metric"];
    threshold: number;
}

const timeRanges = [
    { label: "最近7天", value: "7d" },
    { label: "最近14天", value: "14d" },
    { label: "最近30天", value: "30d" },
];

const metrics: { label: string; value: AnomalyQuery["metric"]; unit: string }[] = [
    { label: "平均延迟", value: "avg_duration_ms", unit: "ms" },
    { label: "P95 延迟", value: "p95_duration_ms", unit: "ms" },
    { label: "P99 延迟", value: "p99_duration_ms", unit: "ms" },
    { label: "平均 Token 数", value: "avg_tokens_per_run", unit: "tokens" },
    { label: "平均首包时间", value: "avg_ttft_ms", unit: "ms" },
];

const thresholds: { label: string; value: number }[] = [
    { label: "严格 (2σ)", value: 2 },
    { label: "标准 (3σ)", value: 3 },
    { label: "宽松 (4σ)", value: 4 },
];

const severityColors = {
    high: {
        bg: "bg-red-100",
        text: "text-red-800",
        border: "border-red-300",
        icon: "text-red-500",
    },
    medium: {
        bg: "bg-orange-100",
        text: "text-orange-800",
        border: "border-orange-300",
        icon: "text-orange-500",
    },
    low: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        border: "border-yellow-300",
        icon: "text-yellow-500",
    },
};

const AnomalyCard = (props: {
    anomaly: AnomalyResponse["data"]["anomalies"][0];
    metric: AnomalyQuery["metric"];
    unit: string;
}) => {
    const severity = props.anomaly.severity;
    const colors = severityColors[severity];
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    return (
        <div class={`border ${colors.border} ${colors.bg} rounded-lg p-4`}>
            <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2">
                    <AlertTriangle size={16} class={colors.icon} />
                    <span class={`text-xs font-semibold ${colors.text} uppercase`}>
                        {severity} 严重程度
                    </span>
                </div>
                <span class="text-xs text-gray-500">
                    {formatDate(props.anomaly.time)}
                </span>
            </div>

            <div class="mb-2">
                <div class="text-lg font-bold text-gray-900">
                    {props.anomaly.value.toFixed(2)} {props.unit}
                </div>
                <div class="text-sm text-gray-600">
                    Z-Score: <span class="font-mono font-semibold">{props.anomaly.z_score.toFixed(2)}</span>
                </div>
            </div>

            {props.anomaly.z_score > 4 && (
                <div class="flex items-start gap-2 text-xs text-red-600 mt-2">
                    <Info size={12} class="mt-0.5" />
                    <span>极度异常，请立即检查</span>
                </div>
            )}
        </div>
    );
};

const BaselineCard = (props: {
    baseline: AnomalyResponse["data"]["baseline"];
    metric: AnomalyQuery["metric"];
    unit: string;
}) => {
    const formatValue = (value: number) => {
        if (value >= 1000) {
            return (value / 1000).toFixed(2) + "k";
        }
        return value.toFixed(2);
    };

    return (
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h3 class="text-sm font-semibold text-gray-700 mb-3">基线统计</h3>

            <div class="space-y-3">
                <div>
                    <div class="text-xs text-gray-500 mb-1">平均值</div>
                    <div class="text-xl font-bold text-gray-900">
                        {formatValue(props.baseline.mean)}
                        <span class="text-sm text-gray-500 ml-1">{props.unit}</span>
                    </div>
                </div>

                <div>
                    <div class="text-xs text-gray-500 mb-1">标准差</div>
                    <div class="text-lg font-medium text-gray-700">
                        {formatValue(props.baseline.stddev)}
                        <span class="text-xs text-gray-500 ml-1">{props.unit}</span>
                    </div>
                </div>

                <div class="border-t border-gray-100 pt-3">
                    <div class="text-xs text-gray-500 mb-2">阈值范围</div>
                    <div class="flex justify-between items-center">
                        <div class="text-center">
                            <div class="text-xs text-gray-500 mb-1">下限</div>
                            <div class="text-sm font-medium text-blue-600">
                                {formatValue(props.baseline.lower_threshold)}
                            </div>
                        </div>
                        <div class="flex-1 mx-4 h-2 bg-gradient-to-r from-blue-500 via-green-500 to-blue-500 rounded"></div>
                        <div class="text-center">
                            <div class="text-xs text-gray-500 mb-1">上限</div>
                            <div class="text-sm font-medium text-blue-600">
                                {formatValue(props.baseline.upper_threshold)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AnomalyDetectionPage = (): JSX.Element => {
    const [filters, setFilters] = createSignal<FilterState>({
        startTime: sevenDaysAgo(),
        endTime: todayEnd(),
        metric: "avg_duration_ms",
        threshold: 3,
    });

    const [selectedTimeRange, setSelectedTimeRange] = createSignal<string>("7d");

    const [anomalyData] = createResource(
        filters,
        async (currentFilters) => {
            try {
                const query: AnomalyQuery = {
                    metric: currentFilters.metric,
                    start_time: currentFilters.startTime.toISOString(),
                    end_time: currentFilters.endTime.toISOString(),
                    threshold: currentFilters.threshold,
                };

                const response = await getAnomalies(query);
                return response;
            } catch (err) {
                console.error("Failed to fetch anomaly data", err);
                return {
                    success: false,
                    data: {
                        metric: currentFilters.metric,
                        baseline: {
                            mean: 0,
                            stddev: 0,
                            upper_threshold: 0,
                            lower_threshold: 0,
                        },
                        anomalies: [],
                    },
                } as AnomalyResponse;
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
        }
        setFilters((prev) => ({ ...prev, startTime, endTime }));
    };

    const handleMetricChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        setFilters((prev) => ({ ...prev, metric: target.value as AnomalyQuery["metric"] }));
    };

    const handleThresholdChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        setFilters((prev) => ({ ...prev, threshold: Number(target.value) }));
    };

    const selectedMetricInfo = createMemo(() => {
        return metrics.find((m) => m.value === filters().metric);
    });

    const anomaliesBySeverity = createMemo(() => {
        const anomalies = anomalyData()?.data?.anomalies || [];
        return {
            high: anomalies.filter((a) => a.severity === "high"),
            medium: anomalies.filter((a) => a.severity === "medium"),
            low: anomalies.filter((a) => a.severity === "low"),
        };
    });

    return (
        <div class="bg-gray-50 min-h-screen">
            {/* Fixed Header */}
            <div class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <div class="p-4">
                    <div class="flex items-center gap-3 mb-4">
                        <Activity class="text-blue-600" size={24} />
                        <h1 class="text-2xl font-bold text-gray-800">
                            异常检测
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

                            {/* 指标选择 */}
                            <select
                                class="px-3 py-1.5 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                                onChange={handleMetricChange}
                                value={filters().metric}
                            >
                                <For each={metrics}>
                                    {(metric) => (
                                        <option value={metric.value}>{metric.label}</option>
                                    )}
                                </For>
                            </select>

                            {/* 阈值选择 */}
                            <div class="flex items-center gap-2">
                                <span class="text-sm text-gray-600">异常阈值:</span>
                                <select
                                    class="px-3 py-1.5 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    onChange={handleThresholdChange}
                                    value={filters().threshold}
                                >
                                    <For each={thresholds}>
                                        {(threshold) => (
                                            <option value={threshold.value}>{threshold.label}</option>
                                        )}
                                    </For>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div class="p-4 space-y-4">
                {anomalyData.loading ? (
                    <div class="text-center py-12 text-gray-500">
                        加载异常数据中...
                    </div>
                ) : (
                    <>
                        {/* 统计卡片 */}
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <div class="text-xs text-gray-500 mb-1">检测总数</div>
                                <div class="text-2xl font-bold text-gray-900">
                                    {anomaliesBySeverity().high.length +
                                        anomaliesBySeverity().medium.length +
                                        anomaliesBySeverity().low.length}
                                </div>
                            </div>
                            <div class="bg-red-50 border border-red-200 rounded-lg shadow-sm p-4">
                                <div class="text-xs text-red-600 mb-1">高度异常</div>
                                <div class="text-2xl font-bold text-red-700">
                                    {anomaliesBySeverity().high.length}
                                </div>
                            </div>
                            <div class="bg-orange-50 border border-orange-200 rounded-lg shadow-sm p-4">
                                <div class="text-xs text-orange-600 mb-1">中度异常</div>
                                <div class="text-2xl font-bold text-orange-700">
                                    {anomaliesBySeverity().medium.length}
                                </div>
                            </div>
                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm p-4">
                                <div class="text-xs text-yellow-600 mb-1">低度异常</div>
                                <div class="text-2xl font-bold text-yellow-700">
                                    {anomaliesBySeverity().low.length}
                                </div>
                            </div>
                        </div>

                        {/* 图表和基线 */}
                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div class="lg:col-span-2 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <h2 class="text-lg font-semibold text-gray-700 mb-3">
                                    趋势图表
                                </h2>
                                <AnomalyChart
                                    data={anomalyData()?.data?.anomalies.map((a) => ({
                                        time: a.time,
                                        value: a.value,
                                        isAnomaly: true,
                                        zScore: a.z_score,
                                        severity: a.severity,
                                    })) || []}
                                    baseline={anomalyData()?.data?.baseline || {
                                        mean: 0,
                                        stddev: 0,
                                        upper_threshold: 0,
                                        lower_threshold: 0,
                                    }}
                                    unit={selectedMetricInfo()?.unit || ""}
                                    height={400}
                                    showPoints={true}
                                />
                            </div>

                            <BaselineCard
                                baseline={anomalyData()?.data?.baseline || {
                                    mean: 0,
                                    stddev: 0,
                                    upper_threshold: 0,
                                    lower_threshold: 0,
                                }}
                                metric={filters().metric}
                                unit={selectedMetricInfo()?.unit || ""}
                            />
                        </div>

                        {/* 异常列表 */}
                        <div>
                            <h2 class="text-lg font-semibold text-gray-700 mb-3">
                                异常详情
                            </h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                <For each={anomalyData()?.data?.anomalies || []}>
                                    {(anomaly) => (
                                        <AnomalyCard
                                            anomaly={anomaly}
                                            metric={filters().metric}
                                            unit={selectedMetricInfo()?.unit || ""}
                                        />
                                    )}
                                </For>
                            </div>

                            {anomalyData()?.data?.anomalies?.length === 0 && (
                                <div class="text-center py-12 text-gray-500 bg-white border border-gray-200 rounded-lg">
                                    <div class="flex items-center justify-center gap-2 mb-2">
                                        <Activity size={32} class="text-gray-400" />
                                    </div>
                                    <div class="text-lg font-medium text-gray-700 mb-1">
                                        未检测到异常
                                    </div>
                                    <div class="text-sm text-gray-500">
                                        当前时间段内没有发现{selectedMetricInfo()?.label || ""}异常
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AnomalyDetectionPage;
