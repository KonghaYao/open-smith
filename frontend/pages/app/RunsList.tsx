import { RunItem } from "./RunItem.jsx";
import { createMemo, createSignal, type Accessor } from "solid-js";
import { RefreshCcw } from "lucide-solid";
import type { RunRecord, TraceInfo } from "../../../src/types.js";

interface RunsListProps {
    selectedTraceId: Accessor<string | null>;
    selectedRunId: Accessor<string | null>;
    currentTraceData: Accessor<TraceInfo | null>;
    onRunSelect: (runId: string) => void;
    onLoadTrace: () => void;
    refresh: () => void;
    refreshTrigger: Accessor<number>;
}

// RunsList 组件 (中间面板)
export const RunsList = (props: RunsListProps) => {
    const runs = createMemo(() => {
        const runs = (props.currentTraceData()?.runs || []).map(
            (i: RunRecord) => {
                return { ...i, extraData: JSON.parse(i.extra!) };
            }
        );
        // 第一阶段：重新排序
        const groupList = new Map();
        runs.forEach((i) => {
            const metadata = i.extraData.metadata;
            const checkpointNs =
                metadata.checkpoint_ns || metadata.langgraph_checkpoint_ns;
            if (groupList.get(checkpointNs)) {
                groupList.get(checkpointNs).push(i);
            } else {
                groupList.set(checkpointNs, [i]);
            }
            return i;
        });
        return Array.from(groupList.values()).flat();
    });
    const [showNoneTime, setShowNoneTime] = createSignal(false);
    // const { refresh } = useRefresh(); // 移除 Context 使用

    const hasSpentTime = (run: RunRecord) => {
        if (run.name === "tools") {
            return false;
        }
        if (showNoneTime() || run.run_type === "tool") {
            return true;
        }
        return parseInt(run.end_time) - parseInt(run.start_time) > 10;
    };

    const totalDuration = createMemo(() => {
        return (
            new Date(props.currentTraceData()?.last_run_time || "").getTime() -
            new Date(props.currentTraceData()?.first_run_time || "").getTime()
        );
    });

    const totalTokens = createMemo(() => {
        return runs().reduce((sum, run) => {
            return sum + (run.total_tokens || 0);
        }, 0);
    });

    return (
        <div class="flex-none w-sm flex flex-col bg-white border-l border-gray-200">
            <div class="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 class="text-lg font-semibold text-gray-900">Runs</h2>
                <div class="flex items-center space-x-2">
                    <span class="text-sm text-gray-500">
                        {runs()?.length} runs
                    </span>
                    <button
                        class="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                        onClick={props.refresh}
                        title="刷新数据">
                        <RefreshCcw class="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-auto p-4 scrollbar">
                {runs().length === 0 ? (
                    <div class="text-center text-gray-500 py-8">
                        暂无 Run 数据
                    </div>
                ) : (
                    <div>
                        {runs().map(
                            (run) =>
                                hasSpentTime(run) &&
                                RunItem({
                                    run,
                                    isSelected: () =>
                                        props.selectedRunId() === run.id,
                                    onSelect: props.onRunSelect,
                                })
                        )}
                    </div>
                )}
            </div>
            <div class="p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="flex flex-col items-start">
                        <span class="text-xs text-gray-500 mb-1">总耗时</span>
                        <span class="text-lg font-semibold text-blue-700">
                            {(totalDuration() / 1000).toFixed(2)}
                            <span class="text-sm font-normal text-gray-500 ml-1">
                                s
                            </span>
                        </span>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-xs text-gray-500 mb-1">总 Token</span>
                        <span class="text-lg font-semibold text-green-700">
                            {totalTokens()}
                        </span>
                    </div>
                </div>
                <button
                    class="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg shadow hover:from-blue-600 hover:to-blue-700 transition font-medium"
                    onClick={() => setShowNoneTime(!showNoneTime())}>
                    {showNoneTime() ? "隐藏无耗时步骤" : "显示无耗时步骤"}
                </button>
            </div>
        </div>
    );
};
