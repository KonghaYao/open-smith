import { createMemo, onMount } from "solid-js";
import { Chart as ChartJS, type ChartConfiguration, type ChartEvent } from "chart.js";
import type { Component } from "solid-js";

interface AnomalyData {
    time: string;
    value: number;
    isAnomaly?: boolean;
    zScore?: number;
    severity?: "high" | "medium" | "low";
}

interface BaselineData {
    mean: number;
    stddev: number;
    upper_threshold: number;
    lower_threshold: number;
}

interface AnomalyChartProps {
    data: AnomalyData[];
    baseline: BaselineData;
    title?: string;
    unit?: string;
    showGrid?: boolean;
    showPoints?: boolean;
    height?: number;
    width?: number;
    onClick?: (event: ChartEvent, elements: any[]) => void;
}

const AnomalyChart: Component<AnomalyChartProps> = (props) => {
    let chartRef: HTMLCanvasElement | undefined;
    let chartInstance: ChartJS | undefined;

    const chartData = createMemo(() => {
        const data = props.data || [];
        const baseline = props.baseline;

        return {
            labels: data.map((d) => new Date(d.time).toLocaleString()),
            datasets: [
                {
                    label: "数据值",
                    data: data.map((d) => d.value),
                    borderColor: "rgb(75, 192, 192)",
                    backgroundColor: "rgb(75, 192, 192)".replace("rgb", "rgba").replace(")", ", 0.1)"),
                    borderWidth: 2,
                    pointRadius: props.showPoints
                        ? data.map((d) => (d.isAnomaly ? 6 : 3))
                        : data.map((d) => (d.isAnomaly ? 6 : 0)),
                    pointHoverRadius: 8,
                    pointBackgroundColor: data.map((d) =>
                        d.isAnomaly
                            ? d.severity === "high"
                                ? "rgb(255, 0, 0)"
                                : d.severity === "medium"
                                ? "rgb(255, 165, 0)"
                                : "rgb(255, 255, 0)"
                            : "rgb(75, 192, 192)"
                    ),
                    pointBorderColor: data.map((d) =>
                        d.isAnomaly
                            ? d.severity === "high"
                                ? "rgb(255, 0, 0)"
                                : d.severity === "medium"
                                ? "rgb(255, 165, 0)"
                                : "rgb(255, 255, 0)"
                            : "rgb(75, 192, 192)"
                    ),
                    tension: 0.1,
                    fill: false,
                },
                {
                    label: "上阈值",
                    data: data.map(() => baseline.upper_threshold),
                    borderColor: "rgb(255, 99, 132)",
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                },
                {
                    label: "下阈值",
                    data: data.map(() => baseline.lower_threshold),
                    borderColor: "rgb(255, 99, 132)",
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                },
                {
                    label: "平均值",
                    data: data.map(() => baseline.mean),
                    borderColor: "rgb(153, 102, 255)",
                    borderWidth: 2,
                    borderDash: [10, 5],
                    pointRadius: 0,
                    fill: false,
                },
            ],
        };
    });

    const chartOptions = createMemo(() => {
        const unit = props.unit || "";
        const defaultOptions: ChartConfiguration<"line">["options"] = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index" as const,
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top" as const,
                },
                tooltip: {
                    mode: "index" as const,
                    intersect: false,
                    callbacks: {
                        label: (context: any) => {
                        const value = context.parsed.y;
                        const unitLabel = unit ? ` ${unit}` : "";
                        const datasetLabel = context.dataset.label || "";
                        return `${datasetLabel}: ${value.toFixed(2)}${unitLabel}`;
                    },
                    afterLabel: (context: any) => {
                        if (context.datasetIndex === 0) {
                            const dataIndex = context.dataIndex;
                            const dataPoint = props.data[dataIndex];
                            if (dataPoint?.isAnomaly) {
                                return [
                                    `异常 Z-Score: ${dataPoint.zScore?.toFixed(2)}`,
                                    `严重程度: ${dataPoint.severity}`,
                                ];
                            }
                        }
                        return null;
                    },
                },
                annotation: {
                    annotations: {
                        // 可以在这里添加动态标注（需要 chartjs-plugin-annotation）
                    },
                },
            },
            scales: {
                x: {
                    grid: {
                        display: props.showGrid,
                    },
                    ticks: {
                        maxTicksLimit: 10,
                    },
                },
                y: {
                    grid: {
                        display: props.showGrid,
                    },
                    title: {
                        display: !!unit,
                        text: unit,
                    },
                },
            },
        };

        return defaultOptions;
    });

    onMount(() => {
        if (chartRef) {
            const ctx = chartRef.getContext("2d");
            if (!ctx) return;

            chartInstance = new ChartJS(ctx, {
                type: "line",
                data: chartData(),
                options: chartOptions(),
            });

            if (props.onClick) {
                chartInstance.options.onClick = (event, elements) => {
                    props.onClick!(event, elements);
                };
            }
        }

        return () => {
            if (chartInstance) {
                chartInstance.destroy();
            }
        };
    });

    // 响应式更新
    createMemo(() => {
        if (chartInstance) {
            chartInstance.data = chartData();
            chartInstance.options = chartOptions();
            chartInstance.update();
        }
    });

    return (
        <div
            class="chart-container"
            style={{
                height: props.height ? `${props.height}px` : "100%",
                width: props.width ? `${props.width}px` : "100%",
                position: "relative",
            }}
        >
            <canvas ref={chartRef} />
        </div>
    );
};

export default AnomalyChart;
