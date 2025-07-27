import { type Accessor } from "solid-js";
import { TimeAgo } from "../../components/TimeAgo.jsx";
import type { TraceOverview } from "../../../src/types.js";

export const TracesSimpleList = (props: {
    filteredTraces: () => TraceOverview[];
    traces: () => TraceOverview[];
    onTraceSelect: (traceId: string) => void;
    selectedTraceId: Accessor<string | null>;
}) => {
    const handleTraceClick = (traceId: string) => {
        props.onTraceSelect(traceId);
    };

    return (
        <div class="border-t border-gray-300 pt-3 flex-1 overflow-auto">
            <h3 class="text-sm font-medium text-gray-600 mb-2">
                📋 多轮对话 ({props.filteredTraces().length})
            </h3>

            {props.filteredTraces().length === 0 ? (
                <div class="text-center text-gray-500 py-2">
                    <p class="text-xs">暂无traces</p>
                </div>
            ) : (
                <div class="space-y-1">
                    {[...props.filteredTraces()]
                        .reverse()
                        .map((trace, index) => {
                            const isSelected =
                                props.selectedTraceId() === trace.trace_id;
                            const panelCard = `trace-item card-hover py-1 px-2 m-2  bg-white border-2  rounded-lg cursor-pointer ${
                                isSelected
                                    ? "border-blue-500"
                                    : "border-gray-200"
                            }`;
                            return (
                                <div
                                    onClick={() =>
                                        handleTraceClick(trace.trace_id)
                                    }
                                    class={panelCard}>
                                    <div class="flex items-center justify-between">
                                        <span class="font-mono text-gray-700 truncate">
                                            Run {index + 1}: {trace.trace_id}
                                        </span>
                                    </div>
                                    <div class="mt-0.5">
                                        <TimeAgo
                                            datetime={trace.last_run_time}
                                            class="text-gray-400 text-xs"
                                        />
                                        <span class="whitespace-nowrap inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full mr-1 font-mono">
                                            🪙 {trace.total_tokens_sum || 0}
                                        </span>
                                        <span class="whitespace-nowrap inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-mono">
                                            ⏱️{" "}
                                            {formatDuration(
                                                new Date(
                                                    trace.last_run_time
                                                ).getTime() -
                                                    new Date(
                                                        trace.first_run_time
                                                    ).getTime()
                                            )}
                                        </span>
                                        <span
                                            class="whitespace-nowrap inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-mono ml-1"
                                            title="用户ID">
                                            👤 {trace.user_id}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
};

export const formatDuration = (duration: number) => {
    if (duration < 1000) return "0.0s";
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = (duration % 60000) / 1000;
    let result = [];
    if (hours > 0) result.push(`${hours}h`);
    if (minutes > 0 || hours > 0) result.push(`${minutes}m`);
    result.push(`${seconds.toFixed(1)}s`);
    return result.join(" ");
};
