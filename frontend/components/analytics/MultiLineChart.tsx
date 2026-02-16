import { createMemo, onMount } from "solid-js";
import { Chart as ChartJS, type ChartConfiguration, type ChartEvent } from "chart.js";
import type { Component } from "solid-js";

interface SeriesData {
    label: string;
    data: Array<{ time: string; value: number }>;
    color?: string;
}

interface MultiLineChartProps {
    series: SeriesData[];
    title?: string;
    unit?: string;
    showGrid?: boolean;
    showPoints?: boolean;
    smoothLine?: boolean;
    height?: number;
    width?: number;
    onClick?: (event: ChartEvent, elements: any[]) => void;
}

const MultiLineChart: Component<MultiLineChartProps> = (props) => {
    let chartRef: HTMLCanvasElement | undefined;
    let chartInstance: ChartJS | undefined;

    const colorPalette = [
        "rgb(75, 192, 192)",
        "rgb(255, 99, 132)",
        "rgb(53, 162, 235)",
        "rgb(255, 206, 86)",
        "rgb(153, 102, 255)",
        "rgb(255, 159, 64)",
        "rgb(199, 199, 199)",
        "rgb(83, 102, 255)",
        "rgb(255, 205, 86)",
    ];

    const chartData = createMemo(() => {
        const series = props.series || [];
        if (series.length === 0) {
            return { labels: [], datasets: [] };
        }

        // Collect all unique time points
        const allTimes = new Set<string>();
        series.forEach((s) => {
            s.data.forEach((d) => allTimes.add(d.time));
        });
        const sortedTimes = Array.from(allTimes).sort();

        const datasets = series.map((s, index) => {
            const color = s.color || colorPalette[index % colorPalette.length];
            const dataMap = new Map(s.data.map((d) => [d.time, d.value]));

            return {
                label: s.label,
                data: sortedTimes.map((time) => dataMap.get(time) || null),
                borderColor: color,
                backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.2)"),
                borderWidth: 2,
                pointRadius: props.showPoints ? 4 : 0,
                pointHoverRadius: 6,
                tension: props.smoothLine ? 0.4 : 0,
                fill: false,
                spanGaps: true,
            };
        });

        return {
            labels: sortedTimes.map((time) => new Date(time).toLocaleString()),
            datasets,
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
                            return `${context.dataset.label}: ${value}${unitLabel}`;
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

export default MultiLineChart;
