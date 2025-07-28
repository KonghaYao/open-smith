import { createEffect, onCleanup, type Accessor, type JSX } from "solid-js";
import { Chart as ChartJS, registerables } from "chart.js";
import type { ChartConfiguration } from "chart.js";

ChartJS.register(...registerables);

interface ChartProps {
    type: ChartConfiguration["type"];
    data: ChartConfiguration["data"];
    options?: ChartConfiguration["options"];
}

export function Chart(props: ChartProps): JSX.Element {
    let chartRef: HTMLCanvasElement | undefined;
    let chartInstance: ChartJS | undefined;

    createEffect(() => {
        if (chartRef) {
            if (chartInstance) {
                chartInstance.destroy();
            }

            chartInstance = new ChartJS(chartRef, {
                type: props.type,
                data: props.data,
                options: props.options,
            });
        }
    });

    onCleanup(() => {
        if (chartInstance) {
            chartInstance.destroy();
        }
    });

    return <canvas ref={chartRef}></canvas>;
}
