/// <reference types="solid-js/jsx-runtime" />

import {
    createSignal,
    createResource,
    For,
    type JSX,
    createMemo,
} from "solid-js";
import { ofetch } from "../api.js";
import type { RunStatsHourlyRecord } from "../../src/types.js";
import { Table, type TableColumn } from "../components/Table.js";
import { Chart } from "../components/Chart.js";
import type { ChartConfiguration } from "chart.js";

const sevenDaysAgo = (): Date => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
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
                class="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-64 text-left bg-white flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen())}>
                <span class="truncate">
                    {selectedLabels().length > 0
                        ? selectedLabels().length > 2
                            ? `已选择 ${selectedLabels().length} 项`
                            : selectedLabels().join(", ")
                        : props.placeholder}
                </span>
                <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {isOpen() && (
                <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    <For each={props.options}>
                        {(option) => (
                            <div
                                class={`px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center ${
                                    props.value.includes(option.value)
                                        ? "bg-blue-50"
                                        : ""
                                }`}
                                onClick={() => handleOptionClick(option.value)}>
                                <input
                                    type="checkbox"
                                    checked={props.value.includes(option.value)}
                                    class="mr-2"
                                    readOnly
                                />
                                <span class="text-sm">{option.label}</span>
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
        endTime: new Date(),
        modelName: null,
        system: null,
    });

    const [selectedTimeRange, setSelectedTimeRange] =
        createSignal<string>("7d");

    const [availableFilters] = createResource(async () => {
        try {
            const [models, systems, traces] = await Promise.all([
                ofetch("/trace/models"),
                ofetch("/trace/systems"),
                ofetch("/trace"), // Still fetch traces for now if needed elsewhere
            ]);
            // const runTypes = [
            //     ...new Set(traces.traces.flatMap((t: any) => t.run_types)),
            // ];
            return {
                modelNames: (models.model_names || []) as string[],
                systems: (systems.systems || []) as string[],
                // runTypes: (runTypes || []) as string[],
            };
        } catch (err) {
            console.error("Failed to fetch available filters", err);
            return { modelNames: [], systems: [], runTypes: [] };
        }
    });

    const [statsData] = createResource(filters, async (currentFilters) => {
        try {
            const params: Record<string, string> = {
                startTime: currentFilters.startTime.toISOString(),
                endTime: currentFilters.endTime.toISOString(),
            };
            if (currentFilters.modelName)
                params.model_name = currentFilters.modelName;
            if (currentFilters.system) params.system = currentFilters.system;

            const response = await ofetch("/stats/hourly", {
                params,
            });
            return (response.stats || []) as RunStatsHourlyRecord[];
        } catch (err) {
            console.error("Failed to fetch statistics", err);
            return [];
        }
    });

    // 修改为多选指标
    const [selectedMetrics, setSelectedMetrics] = createSignal<
        (keyof RunStatsHourlyRecord)[]
    >(["total_runs", "p99_duration_ms", "total_tokens_sum", "distinct_users"]);

    // 按模型统计趋势的独立多选指标
    const [selectedMetric, setSelectedMetric] =
        createSignal<keyof RunStatsHourlyRecord>("total_runs");

    const availableMetrics: {
        value: keyof RunStatsHourlyRecord;
        label: string;
        yAxisId?: string;
        unit?: string;
    }[] = [
        { value: "total_runs", label: "总运行次数", yAxisId: "y" },
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

    const modelColorsWithAlpha = modelColors.map((color) =>
        color.replace("rgb", "rgba").replace(")", ", 0.5)")
    );

    const handleMetricChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        setSelectedMetric(target.value as keyof RunStatsHourlyRecord);
    };

    // 修改图表数据生成逻辑以支持多指标
    const chartData = createMemo(() => {
        const data = statsData() || [];
        const metrics = selectedMetrics();

        if (!data.length || !metrics.length) {
            return { labels: [], datasets: [] };
        }

        const labels = data.map((d) => new Date(d.stat_hour).toLocaleString());

        const datasets = metrics.map((metric, index) => {
            const metricInfo = availableMetrics.find((m) => m.value === metric);
            const values = data.map((d) => {
                let value = d[metric] as number;
                if (metric === "error_rate") {
                    value *= 100;
                } else if (
                    metric.includes("duration_ms") ||
                    metric.includes("ttft_ms")
                ) {
                    value /= 1000; // Convert ms to s
                } else if (metric.includes("tokens")) {
                    value /= 1000; // Convert tokens to k
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

        return {
            labels,
            datasets,
        };
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
        const data = statsData() || [];
        const metric = selectedMetric(); // 使用单选指标信号

        if (!data.length) {
            return { labels: [], datasets: [] };
        }

        const labels = [...new Set(data.map((d) => d.stat_hour))].sort();
        const localeLabels = labels.map((l) => new Date(l).toLocaleString());

        const dataByModel = data.reduce((acc, record) => {
            const modelName = record.model_name || "未知模型";
            if (!acc[modelName]) {
                acc[modelName] = [];
            }
            acc[modelName].push(record);
            return acc;
        }, {} as Record<string, RunStatsHourlyRecord[]>);

        const datasets = Object.keys(dataByModel).map((modelName, index) => {
            const modelData = dataByModel[modelName];
            const hourDataMap = new Map(modelData.map((d) => [d.stat_hour, d]));

            const chartDataPoints = labels.map((label) => {
                const record = hourDataMap.get(label);
                if (!record) return null;

                let value = record[metric] as number;
                if (metric === "error_rate") {
                    value *= 100;
                } else if (
                    metric.includes("duration_ms") ||
                    metric.includes("ttft_ms")
                ) {
                    value /= 1000; // Convert ms to s
                } else if (metric.includes("tokens")) {
                    value /= 1000; // Convert tokens to k
                }
                return value;
            });

            return {
                label: modelName,
                data: chartDataPoints,
                borderColor: metricColors[index % metricColors.length],
                backgroundColor: metricColors[index % metricColors.length]
                    .replace("rgb", "rgba")
                    .replace(")", ", 0.5)"),
                tension: 0.1,
            };
        });

        return {
            labels: localeLabels,
            datasets,
        };
    });

    const newModelChartOptions = createMemo(() => {
        const metric = selectedMetric(); // 使用单选指标信号
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
        value: Filters[K]
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

    const statsColumns: TableColumn<RunStatsHourlyRecord>[] = [
        {
            header: "小时",
            key: "stat_hour",
            class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
            format: (row) => new Date(row.stat_hour).toLocaleString(),
        },
        {
            header: "模型",
            key: "model_name",
            class: "px-6 py-4 whitespace-nowrap text-sm text-gray-500",
            format: (row) => row.model_name || "N/A",
        },
        {
            header: "系统",
            key: "system",
            class: "px-6 py-4 whitespace-nowrap text-sm text-gray-500",
            format: (row) => row.system || "N/A",
        },
        {
            header: "运行统计",
            key: ["total_runs", "successful_runs", "failed_runs"],
            class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
            format: (row) => (
                <>
                    总: {row.total_runs}
                    <br />
                    成: {row.successful_runs}
                    <br />
                    败: {row.failed_runs}
                </>
            ),
        },
        {
            header: "错误率",
            key: "error_rate",
            class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
            format: (row) => `${(row.error_rate * 100).toFixed(2)}%`,
        },
        {
            header: "持续时间 (s)",
            key: ["avg_duration_ms", "p95_duration_ms", "p99_duration_ms"],
            class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
            format: (row) => (
                <>
                    平均: {(row.avg_duration_ms / 1000).toFixed(1)}
                    <br />
                    P95: {(row.p95_duration_ms / 1000).toFixed(1)}
                    <br />
                    P99: {(row.p99_duration_ms / 1000).toFixed(1)}
                </>
            ),
        },
        {
            header: "Token (总/平均)",
            key: ["total_tokens_sum", "avg_tokens_per_run"],
            class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
            format: (row) => (
                <>
                    总: {(row.total_tokens_sum / 1000).toFixed(1)}k
                    <br />
                    平均: {(row.avg_tokens_per_run / 1000).toFixed(1)}k
                </>
            ),
        },
        {
            header: "首包时间 (s)",
            key: ["avg_ttft_ms", "p95_ttft_ms"],
            class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
            format: (row) => (
                <>
                    平均: {(row.avg_ttft_ms / 1000).toFixed(1)}
                    <br />
                    P95: {(row.p95_ttft_ms / 1000).toFixed(1)}
                </>
            ),
        },
        {
            header: "独立用户数",
            key: "distinct_users",
            class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
        },
    ];

    return (
        <div class="p-6 space-y-4 bg-gray-50 min-h-screen">
            <h1 class="text-3xl font-bold text-gray-800">LLM 运行统计面板</h1>

            <div class="p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div class="flex flex-wrap gap-4 items-center">
                    <div class="flex items-center gap-2">
                        <For each={timeRanges}>
                            {(range) => (
                                <button
                                    class={`p-2 rounded-md border text-sm ${
                                        selectedTimeRange() === range.value
                                            ? "bg-blue-500 text-white border-blue-500"
                                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                                    }`}
                                    onClick={() =>
                                        handleTimeRangeChange(range.value)
                                    }>
                                    {range.label}
                                </button>
                            )}
                        </For>
                    </div>

                    {/* Selects */}
                    <select
                        class="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-48"
                        onchange={(e) => handleSelectChange("modelName", e)}>
                        <option value="">所有模型</option>
                        <For each={availableFilters()?.modelNames}>
                            {(name) => <option value={name}>{name}</option>}
                        </For>
                    </select>

                    <select
                        class="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-48"
                        onchange={(e) => handleSelectChange("system", e)}>
                        <option value="">所有系统</option>
                        <For each={availableFilters()?.systems}>
                            {(sys) => <option value={sys}>{sys}</option>}
                        </For>
                    </select>
                </div>
            </div>

            <div class="flex flex-wrap gap-4">
                <div class="flex-1 p-5 bg-white border border-gray-200 rounded-lg shadow-sm h-96">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-semibold text-gray-700">
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
                    {statsData.loading ? (
                        <div class="text-center p-8 text-gray-500">
                            正在加载图表数据...
                        </div>
                    ) : statsData()?.length && selectedMetrics().length ? (
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

                <div class="flex-1 p-5 bg-white border border-gray-200 rounded-lg shadow-sm h-96">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-semibold text-gray-700">
                            模型性能趋势
                        </h2>
                        <select
                            class="p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-48"
                            onchange={(e) => handleMetricChange(e)}>
                            <option value="total_runs">总运行次数</option>
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
                            <option value="avg_ttft_ms">平均首包时间</option>
                            <option value="p95_ttft_ms">P95 首包时间</option>
                            <option value="total_tokens_sum">
                                总 Token 数
                            </option>
                            <option value="avg_tokens_per_run">
                                平均 Token 数
                            </option>
                            <option value="distinct_users">独立用户数</option>
                        </select>
                    </div>
                    {statsData.loading ? (
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
                            {selectedMetric() === "total_runs"
                                ? "请选择一个统计指标"
                                : "没有符合所选筛选器的数据可用于按模型图表。"}
                        </div>
                    )}
                </div>
            </div>

            <div class="p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
                <h2 class="text-xl font-semibold text-gray-700 mb-4">
                    运行数据明细
                </h2>
                <Table
                    columnsConfig={statsColumns}
                    data={statsData() || []}
                    loading={statsData.loading}
                    error={statsData.error}
                    onRowClick={() => {}}
                />
            </div>
        </div>
    );
};

export default StatsPage;
