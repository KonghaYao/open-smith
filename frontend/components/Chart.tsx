import { createMemo, onMount } from "solid-js";
import {
    Chart as ChartJS,
    type ChartConfiguration,
    type ChartEvent,
    type ChartTypeRegistry,
    LinearScale,
    CategoryScale,
    LineController,
    BarController,
    DoughnutController,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
} from "chart.js";
import type { Component } from "solid-js";

// 注册所需的控制器、元素和 scale 类型
ChartJS.register(
    LinearScale,
    CategoryScale,
    LineController,
    BarController,
    DoughnutController,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
);

// 简单的深合并函数
function deepMerge(target: any, source: any): any {
    if (typeof target !== "object" || typeof source !== "object") {
        return source;
    }

    const output = { ...target };

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (
                typeof source[key] === "object" &&
                source[key] !== null &&
                !Array.isArray(source[key])
            ) {
                output[key] = deepMerge(target[key] || {}, source[key]);
            } else {
                output[key] = source[key];
            }
        }
    }

    return output;
}

interface BaseChartProps {
    type: keyof ChartTypeRegistry;
    data: ChartConfiguration<"line" | "bar" | "scatter" | "doughnut">["data"];
    labels?: string[];
    options?: ChartConfiguration<"line" | "bar" | "scatter" | "doughnut">["options"];
    class?: string;
    height?: number;
    width?: number;
    onClick?: (event: ChartEvent, elements: any[]) => void;
}

const Chart: Component<BaseChartProps> = (props) => {
    let chartRef: HTMLCanvasElement | undefined;
    let chartInstance: ChartJS | undefined;

    onMount(() => {
        if (chartRef) {
            const ctx = chartRef.getContext("2d");
            if (!ctx) return;

            const defaultOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top" as const,
                    },
                    tooltip: {
                        mode: "index" as const,
                        intersect: false,
                    },
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                        },
                    },
                    y: {
                        beginAtZero: true,
                    },
                },
            };

            const finalOptions = deepMerge(defaultOptions, props.options || {});

            chartInstance = new ChartJS(ctx, {
                type: props.type,
                data: props.data,
                options: finalOptions,
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
        if (chartInstance && props.data) {
            console.log('Chart component - updating data:', props.data);
            chartInstance.data = props.data;
            if (props.options) {
                chartInstance.options = deepMerge(
                    chartInstance.options,
                    props.options,
                );
            }
            console.log('Chart component - calling update()');
            chartInstance.update();
        }
    });

    return (
        <div
            class={`chart-container ${props.class || ""}`}
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

export default Chart;
