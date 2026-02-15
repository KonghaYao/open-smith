import { createMemo, onMount } from "solid-js";
import { Chart as ChartJS, type ChartConfiguration, type ChartEvent } from "chart.js";
import type { Component } from "solid-js";

interface TimeSeriesData {
    time: string;
    value: number;
    label?: string;
}

interface TimeSeriesChartProps {
    data: TimeSeriesData[];
    labels?: string[];
    title?: string;
    unit?: string;
    showGrid?: boolean;
    showPoints?: boolean;
    color?: string;
    height?: number;
    width?: number;
    onClick?: (event: ChartEvent, elements: any[]) => void;
    smoothLine?: boolean;
}

const TimeSeriesChart: Component<TimeSeriesChartProps> = (props) => {
    let chartRef: HTMLCanvasElement | undefined;
    let chartInstance: ChartJS | undefined;

    const defaultColor = "rgb(75, 192, 192)";

    const chartData = createMemo(() => {
        const data = props.data || [];
        return {
            labels: data.map((d) => new Date(d.time).toLocaleString()),
            datasets: [
                {
                    label: props.title || "值",
                    data: data.map((d) => d.value),
                    borderColor: props.color || defaultColor,
                    backgroundColor: (props.color || defaultColor)
                        .replace("rgb", "rgba")
                        .replace(")", ", 0.2)"),
                    borderWidth: 2,
                    pointRadius: props.showPoints ? 4 : 0,
                    pointHoverRadius: 6,
                    tension: props.smoothLine ? 0.4 : 0,
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
                    display: !!props.title,
                    position: "top" as const,
                },
                tooltip: {
                    mode: "index" as const,
                    intersect: false,
                    callbacks: {
                        label: (context: any) => {
                            const value = context.parsed.y;
                            const unitLabel = unit ? ` ${unit}` : "";
                            return `${context.dataset.label || "值"}: ${value}${unitLabel}`;
                        },
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
                    beginAtZero: true,
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
            chartInstanceData = chartData();
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

export default TimeSeriesChart;
