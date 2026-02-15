import {
    createSignal,
    createResource,
    For,
    type JSX,
    createMemo,
} from "solid-js";
import {
    getTimeseries,
    type TimeseriesQuery,
    type TimeseriesResponse,
    fetch,
} from "../api.js";
import Chart from "../components/Chart.js";
import { BarChart3, TrendingUp } from "lucide-solid";

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

interface Filters {
    startTime: Date;
    endTime: Date;
    modelName: string | null;
    system: string | null;
}

const timeRanges = [
    { label: "最近1小时", value: "1h" },
    { label: "最近3小时", value: "3h" },
    { label: "最近12小时", value: "12h" },
    { label: "最近1天", value: "1d" },
    { label: "最近3天", value: "3d" },
    { label: "最近7天", value: "7d" },
    { label: "最近30天", value: "30d" },
];

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
                <svg
                    class="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {isOpen() && (
                <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-auto">
                    <For each={props.options}>
                        {(option) => (
                            <div
                                class={`px-2 py-1 cursor-pointer hover:bg-gray-100 flex items-center text-xs ${
                                    props.value.includes(option.value)
                                        ? "bg-blue-50"
                                        : ""
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

const StatsPage = (): JSX.Element => {
    const [filters, setFilters] = createSignal<Filters>({
        startTime: sevenDaysAgo(),
        endTime: todayEnd(),
        modelName: null,
        system: null,
    });

    const [selectedTimeRange, setSelectedTimeRange] =
        createSignal<string>("7d");

    // 改用新的 analytics API
    const [timeseriesData] = createResource(filters, async (currentFilters) => {
        try {
            const filtersObj: Record<string, string[]> = {};
            if (currentFilters.modelName)
                filtersObj.model_name = [currentFilters.modelName];
            if (currentFilters.system)
                filtersObj.system = [currentFilters.system];

            const query: TimeseriesQuery = {
                dimension: undefined, // 总体趋势
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
                granularity: "1h",
                start_time: currentFilters.startTime.toISOString(),
                end_time: currentFilters.endTime.toISOString(),
                filters:
                    Object.keys(filtersObj).length > 0 ? filtersObj : undefined,
                limit: 1000,
            };

            console.log("Fetching timeseries data with query:", query);
            const response = await getTimeseries(query);
            console.log("Timeseries response:", response);
            return response;
        } catch (err) {
            console.error("Failed to fetch timeseries data", err);
            return {
                success: false,
                data: [],
                meta: { total: 0, limit: 1000, offset: 0 },
            };
        }
    });

    // 按模型统计的趋势数据
    const [modelTimeseriesData] = createResource(
        filters,
        async (currentFilters) => {
            try {
                const filtersObj: Record<string, string[]> = {};
                if (currentFilters.system)
                    filtersObj.system = [currentFilters.system];

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
                    granularity: "1h",
                    start_time: currentFilters.startTime.toISOString(),
                    end_time: currentFilters.endTime.toISOString(),
                    filters:
                        Object.keys(filtersObj).length > 0
                            ? filtersObj
                            : undefined,
                    limit: 1000,
                };

                const response = await getTimeseries(query);
                return response;
            } catch (err) {
                console.error("Failed to fetch model timeseries data", err);
                return {
                    success: false,
                    data: [],
                    meta: { total: 0, limit: 1000, offset: 0 },
                };
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

    // 修改为多选指标
    const [selectedMetrics, setSelectedMetrics] = createSignal<string[]>([
        "total_runs",
        "p99_duration_ms",
        "total_tokens_sum",
        "distinct_users",
    ]);

    // 按模型统计趋势的独立多选指标
    const [selectedMetric, setSelectedMetric] =
        createSignal<string>("total_runs");

    const availableMetrics: {
        value: string;
        label: string;
        yAxisId?: string;
        unit?: string;
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
        "rgb(199, 199, 199)",
        "rgb(83, 102, 255)",
        "rgb(255, 205, 86)",
        "rgb(201, 203, 207)",
    ];

    const modelColors = [
        "rgb(75, 192, 192)",
        "rgb(255, 99, 132)",
        "rgb(53, 162, 235)",
        "rgb(255, 206, 86)",
        "rgb(153, 102, 255)",
        "rgb(255, 159, 64)",
    ];

    const handleMetricChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        setSelectedMetric(target.value);
    };

    // 修改图表数据生成逻辑以支持多指标
    const chartData = createMemo(() => {
        const data = timeseriesData()?.data || [];
        const metrics = selectedMetrics();

        console.log("chartData - data:", data);
        console.log("chartData - metrics:", metrics);

        if (!data.length || !metrics.length) {
            console.log("chartData - returning empty");
            return { labels: [], datasets: [] };
        }

        const labels = data.map((d) => new Date(d.time).toLocaleString());

        const datasets = metrics.map((metric, index) => {
            const metricInfo = availableMetrics.find((m) => m.value === metric);
            const values = data.map((d) => {
                let value = d.metrics[metric] as number;
                if (metric === "error_rate") {
                    value = value ? value * 100 : 0;
                } else if (
                    metric.includes("duration_ms") ||
                    metric.includes("ttft_ms")
                ) {
                    value = value ? value / 1000 : 0; // Convert ms to s
                } else if (metric.includes("tokens")) {
                    value = value ? value / 1000 : 0; // Convert tokens to k
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

        const result = {
            labels,
            datasets,
        };

        console.log("chartData - result:", result);
        return result;
    });

    const chartOptions = createMemo(() => {
        const metrics = selectedMetrics();
        const yAxes: Record<string, any> = {};

        // 为每个指标类型创建对应的Y轴
        const usedAxes = new Set<string>();
        metrics.forEach((metric) => {
            const metricInfo = availableMetrics.find((m) => m.value === metric);
            if (metricInfo?.yAxisId) {
                usedAxes.add(metricInfo.yAxisId);
            }
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
                title: {
                    display: false,
                    text: "多维度统计趋势",
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
        const data = modelTimeseriesData()?.data || [];
        const metric = selectedMetric();

        if (!data.length) {
            return { labels: [], datasets: [] };
        }

        // 提取所有唯一的时间点作为标签
        const uniqueTimes = Array.from(
            new Set(data.map((d) => d.time))
        ).sort();

        // 按模型分组数据
        const dataByModel = new Map<string, Map<string, number>>();

        data.forEach((d) => {
            const modelName = d.dimensions?.model_name || "未知模型";
            if (!dataByModel.has(modelName)) {
                dataByModel.set(modelName, new Map());
            }
            let value = d.metrics[metric] as number;
            if (metric === "error_rate") {
                value = value ? value * 100 : 0;
            } else if (
                metric.includes("duration_ms") ||
                metric.includes("ttft_ms")
            ) {
                value = value ? value / 1000 : 0;
            } else if (metric.includes("tokens")) {
                value = value ? value / 1000 : 0;
            }
            dataByModel.get(modelName)!.set(d.time, value);
        });

        // 为每个模型创建数据集，确保数据点数量与标签数量一致
        const datasets: any[] = [];
        let index = 0;
        dataByModel.forEach((modelData, modelName) => {
            const color = modelColors[index % modelColors.length];
            const values = uniqueTimes.map((time) => modelData.get(time) ?? null);
            datasets.push({
                label: modelName,
                data: values,
                borderColor: color,
                backgroundColor: color
                    .replace("rgb", "rgba")
                    .replace(")", ", 0.5)"),
                tension: 0.1,
            });
            index++;
        });

        return {
            labels: uniqueTimes.map((time) => new Date(time).toLocaleString()),
            datasets,
        };
    });

    const newModelChartOptions = createMemo(() => {
        const metric = selectedMetric();
        const metricInfo = availableMetrics.find((m) => m.value === metric);
        const titleText = `按模型统计趋势 - ${metricInfo?.label || ""}`;

        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top" as const,
                },
                title: {
                    display: false,
                    text: titleText,
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "时间",
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: metricInfo?.label || "值",
                    },
                    beginAtZero: true,
                },
            },
        };
    });

    const handleFilterChange = <K extends keyof Filters>(
        type: K,
        value: Filters[K],
    ) => {
        setFilters((prev) => ({ ...prev, [type]: value as any }));
    };

    const handleTimeRangeChange = (range: string) => {
        setSelectedTimeRange(range);
        const endTime = new Date();
        const startTime = new Date();
        switch (range) {
            case "1h":
                startTime.setHours(startTime.getHours() - 1);
                break;
            case "3h":
                startTime.setHours(startTime.getHours() - 3);
                break;
            case "12h":
                startTime.setHours(startTime.getHours() - 12);
                break;
            case "1d":
                startTime.setDate(startTime.getDate() - 1);
                break;
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

    const handleSelectChange = (type: "modelName" | "system", event: Event) => {
        const target = event.target as HTMLSelectElement;
        handleFilterChange(type, target.value || null);
    };

    return (
        <div class="bg-gray-50 min-h-screen">
            {/* Fixed Header */}
            <div class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <div class="p-4">
                    <h1 class="text-2xl font-bold text-gray-800 mb-3">
                        LLM 运行统计面板
                    </h1>

                    {/* Compact Filter Section */}
                    <div class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div class="flex flex-wrap gap-2 items-center">
                            <div class="flex items-center gap-1">
                                <For each={timeRanges}>
                                    {(range) => (
                                        <button
                                            class={`px-2 py-1 rounded border text-xs ${
                                                selectedTimeRange() ===
                                                range.value
                                                    ? "bg-blue-500 text-white border-blue-500"
                                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                                            }`}
                                            onClick={() =>
                                                handleTimeRangeChange(
                                                    range.value,
                                                )
                                            }
                                        >
                                            {range.label}
                                        </button>
                                    )}
                                </For>
                            </div>

                            {/* Compact Selects */}
                            <select
                                class="px-2 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 w-32 text-xs"
                                onchange={(e) =>
                                    handleSelectChange("modelName", e)
                                }
                            >
                                <option value="">所有模型</option>
                                <For each={availableFilters()?.modelNames}>
                                    {(name) => (
                                        <option value={name}>{name}</option>
                                    )}
                                </For>
                            </select>

                            <select
                                class="px-2 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 w-32 text-xs"
                                onchange={(e) =>
                                    handleSelectChange("system", e)
                                }
                            >
                                <option value="">所有系统</option>
                                <For each={availableFilters()?.systems}>
                                    {(sys) => (
                                        <option value={sys}>{sys}</option>
                                    )}
                                </For>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div class="p-4 space-y-4">
                <div class="flex flex-wrap gap-4">
                    <div class="flex-1 p-4 bg-white border border-gray-200 rounded-lg shadow-sm h-80">
                        <div class="flex justify-between items-center mb-3">
                            <h2 class="text-lg font-semibold text-gray-700">
                                多指标趋势分析
                            </h2>
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
                        {timeseriesData.loading ? (
                            <div class="text-center p-8 text-gray-500">
                                正在加载图表数据...
                            </div>
                        ) : timeseriesData()?.data?.length &&
                          selectedMetrics().length ? (
                            <div class="h-full">
                                <Chart
                                    type="line"
                                    data={chartData()}
                                    options={chartOptions()}
                                />
                            </div>
                        ) : (
                            <div class="text-center p-8 text-gray-500">
                                {selectedMetrics().length === 0
                                    ? "请选择至少一个统计指标"
                                    : "没有符合所选筛选器的数据可用于图表。"}
                            </div>
                        )}
                    </div>

                    <div class="flex-1 p-4 bg-white border border-gray-200 rounded-lg shadow-sm h-80">
                        <div class="flex justify-between items-center mb-3">
                            <h2 class="text-lg font-semibold text-gray-700">
                                模型性能趋势
                            </h2>
                            <select
                                class="px-2 py-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 w-40 text-xs"
                                onchange={(e) => handleMetricChange(e)}
                            >
                                <option value="total_runs">总运行次数</option>
                                <option value="successful_runs">
                                    成功次数
                                </option>
                                <option value="failed_runs">失败次数</option>
                                <option value="error_rate">错误率</option>
                                <option value="avg_duration_ms">
                                    平均持续时间
                                </option>
                                <option value="p95_duration_ms">
                                    P95 持续时间
                                </option>
                                <option value="p99_duration_ms">
                                    P99 持续时间
                                </option>
                                <option value="avg_ttft_ms">
                                    平均首包时间
                                </option>
                                <option value="p95_ttft_ms">
                                    P95 首包时间
                                </option>
                                <option value="total_tokens_sum">
                                    总 Token 数
                                </option>
                                <option value="avg_tokens_per_run">
                                    平均 Token 数
                                </option>
                            </select>
                        </div>
                        {modelTimeseriesData.loading ? (
                            <div class="text-center p-8 text-gray-500">
                                正在加载图表数据...
                            </div>
                        ) : newModelChartData()?.datasets.length ? (
                            <Chart
                                type="line"
                                data={newModelChartData()}
                                options={newModelChartOptions()}
                            />
                        ) : (
                            <div class="text-center p-8 text-gray-500">
                                没有符合所选筛选器的数据可用于按模型图表。
                            </div>
                        )}
                    </div>
                </div>

                {/* Data Table */}
                {timeseriesData()?.data?.length > 0 && (
                    <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                        <h2 class="text-lg font-semibold text-gray-700 mb-3">
                            数据详情
                        </h2>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="border-b border-gray-200">
                                        <th class="px-4 py-2 text-left font-medium text-gray-700">
                                            时间
                                        </th>
                                        <th class="px-4 py-2 text-left font-medium text-gray-700">
                                            总运行次数
                                        </th>
                                        <th class="px-4 py-2 text-left font-medium text-gray-700">
                                            成功/失败
                                        </th>
                                        <th class="px-4 py-2 text-left font-medium text-gray-700">
                                            错误率
                                        </th>
                                        <th class="px-4 py-2 text-left font-medium text-gray-700">
                                            平均延迟
                                        </th>
                                        <th class="px-4 py-2 text-left font-medium text-gray-700">
                                            Token 数
                                        </th>
                                        <th class="px-4 py-2 text-left font-medium text-gray-700">
                                            独立用户数
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={timeseriesData()?.data || []}>
                                        {(item) => (
                                            <tr class="border-b border-gray-100">
                                                <td class="px-4 py-2 text-gray-900">
                                                    {new Date(
                                                        item.time,
                                                    ).toLocaleString()}
                                                </td>
                                                <td class="px-4 py-2 text-gray-900">
                                                    {(
                                                        item.metrics
                                                            .total_runs || 0
                                                    ).toLocaleString()}
                                                </td>
                                                <td class="px-4 py-2 text-gray-600">
                                                    {(
                                                        item.metrics
                                                            .successful_runs ||
                                                        0
                                                    ).toLocaleString()}{" "}
                                                    /{" "}
                                                    {(
                                                        item.metrics
                                                            .failed_runs || 0
                                                    ).toLocaleString()}
                                                </td>
                                                <td class="px-4 py-2 text-gray-900">
                                                    {(
                                                        (item.metrics
                                                            .error_rate || 0) *
                                                        100
                                                    ).toFixed(2)}
                                                    %
                                                </td>
                                                <td class="px-4 py-2 text-gray-900">
                                                    {(
                                                        (item.metrics
                                                            .avg_duration_ms ||
                                                            0) / 1000
                                                    ).toFixed(2)}
                                                    s
                                                </td>
                                                <td class="px-4 py-2 text-gray-900">
                                                    {(
                                                        (item.metrics
                                                            .total_tokens_sum ||
                                                            0) / 1000
                                                    ).toFixed(1)}
                                                    k
                                                </td>
                                                <td class="px-4 py-2 text-gray-900">
                                                    {(
                                                        item.metrics
                                                            .distinct_users || 0
                                                    ).toLocaleString()}
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsPage;
