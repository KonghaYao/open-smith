import { createMemo, For, onMount } from "solid-js";
import {
    Chart as ChartJS,
    type ChartConfiguration,
    type ChartEvent,
    type ChartTypeRegistry,
} from "chart.js";
import type { Component } from "solid-js";
import { merge as deepMerge } from "lodash-es/merge";

interface BaseChartProps {
    type: keyof ChartTypeRegistry;
    data: ChartConfiguration<"line" | "bar" | "scatter">["data"];
    labels?: string[];
    options?: ChartConfiguration<"line" | "bar" | "scatter">["options"];
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
            chartInstance.data = props.data;
            if (props.options) {
                chartInstance.options = deepMerge(
                    chartInstance.options,
                    props.options,
                );
            }
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
