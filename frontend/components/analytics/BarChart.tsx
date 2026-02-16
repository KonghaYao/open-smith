import { createMemo, onMount } from "solid-js";
import { Chart as ChartJS, type ChartConfiguration, type ChartEvent } from "chart.js";
import type { Component } from "solid-js";

interface BarChartData {
    label: string;
    value: number;
    color?: string;
}

interface BarChartProps {
    data: BarChartData[];
    title?: string;
    horizontal?: boolean;
    showGrid?: boolean;
    height?: number;
    width?: number;
    onClick?: (event: ChartEvent, elements: any[]) => void;
    maxValue?: number;
}

const BarChart: Component<BarChartProps> = (props) => {
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
    ];

    const chartData = createMemo(() => {
        const data = props.data || [];
        return {
            labels: data.map((d) => d.label),
            datasets: [
                {
                    label: props.title || "值",
                    data: data.map((d) => d.value),
                    backgroundColor: data.map((d, i) =>
                        d.color
                            ? d.color.replace("rgb", "rgba").replace(")", ", 0.7)")
                            : colorPalette[i % colorPalette.length].replace(
                                  "rgb",
                                  "rgba",
                              ).replace(")", ", 0.7)")
                    ),
                    borderColor: data.map((d, i) =>
                        d.color || colorPalette[i % colorPalette.length]
                    ),
                    borderWidth: 1,
                },
            ],
        };
    });

    const chartOptions = createMemo(() => {
        const defaultOptions: ChartConfiguration<"bar">["options"] = {
            indexAxis: props.horizontal ? "y" : "x",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: !!props.title,
                    position: "top" as const,
                },
                tooltip: {
                    callbacks: {
                        label: (context: any) => {
                            const value = context.parsed.y || context.parsed.x;
                            return `${context.dataset.label || "值"}: ${value}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: {
                        display: props.showGrid,
                    },
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        display: props.showGrid,
                    },
                    max: props.maxValue,
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
                type: "bar",
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

export default BarChart;
