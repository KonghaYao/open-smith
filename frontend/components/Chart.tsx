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
    let isInitialized = false;

    const initializeChart = () => {
        if (isInitialized || !chartRef) {
            console.log('Chart component - Skipping initialization, isInitialized:', isInitialized, 'chartRef:', !!chartRef);
            return;
        }

        const ctx = chartRef.getContext("2d");
        if (!ctx) {
            console.error('Chart component - Failed to get 2d context');
            return;
        }

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

        console.log('Chart component - Creating ChartJS instance with type:', props.type);
        console.log('Chart component - Data:', props.data);
        console.log('Chart component - Options:', finalOptions);

        try {
            chartInstance = new ChartJS(ctx, {
                type: props.type,
                data: props.data,
                options: finalOptions,
            });
            isInitialized = true;
            console.log('Chart component - ChartJS instance created successfully');

            if (props.onClick) {
                chartInstance.options.onClick = (event, elements) => {
                    props.onClick!(event, elements);
                };
            }
        } catch (error) {
            console.error('Chart component - Failed to create ChartJS instance:', error);
        }
    };

    onMount(() => {
        console.log('Chart component - onMount called');
        console.log('Chart component - chartRef:', chartRef);
        console.log('Chart component - props.type:', props.type);
        console.log('Chart component - props.data:', props.data);

        // 使用 requestAnimationFrame 确保 DOM 已完全渲染
        requestAnimationFrame(() => {
            // 检查数据是否有效（有标签和数据集）
            const hasValidData = props.data && props.data.labels && props.data.labels.length > 0;

            if (hasValidData) {
                console.log('Chart component - Data is valid, initializing chart');
                initializeChart();
            } else {
                console.log('Chart component - Data is not ready, waiting for data update');
            }
        });

        return () => {
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = undefined;
                isInitialized = false;
            }
        };
    });

    // 响应式更新
    createMemo(() => {
        const data = props.data;
        console.log('Chart component - createMemo triggered');
        console.log('Chart component - isInitialized:', isInitialized);
        console.log('Chart component - current data:', data);

        if (isInitialized && chartInstance) {
            // 如果图表已存在，更新它
            console.log('Chart component - Updating existing chart');
            chartInstance.data = data;
            if (props.options) {
                chartInstance.options = deepMerge(
                    chartInstance.options,
                    props.options,
                );
            }
            chartInstance.update();
        } else if (data && data.labels && data.labels.length > 0 && chartRef) {
            // 如果图表不存在但数据有效，初始化图表
            console.log('Chart component - No chart instance but data is valid, creating chart');
            requestAnimationFrame(() => {
                if (!isInitialized) {
                    initializeChart();
                }
            });
        } else {
            console.log('Chart component - Skipping chart creation: no data or chartRef');
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
