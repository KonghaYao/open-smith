import {
    createMemo,
    type Accessor,
    type Resource,
    type Setter,
} from "solid-js";
import { SearchBar } from "./SearchBar.jsx";
import { ThreadList } from "./ThreadList.js";
import { TracesSimpleList } from "./TracesSimpleList.jsx";
import { RefreshCcw } from "lucide-solid";
import type { TraceOverview } from "../../../src/types.js";

export const Statistics = (props: {
    filteredThreads: Accessor<any[]>;
    threads: Accessor<any[] | undefined>;
    selectedThreadId: Accessor<string | null>;
    filteredTraces: Accessor<any[]>;
}) => {
    const data = () => {
        const filteredThreadCount = props.filteredThreads().length;
        const totalThreadCount = (props.threads() || []).length;

        let result =
            filteredThreadCount === totalThreadCount
                ? `${totalThreadCount} 个会话`
                : `${filteredThreadCount}/${totalThreadCount} 个会话`;

        if (props.selectedThreadId()) {
            const traceCount = props.filteredTraces().length;
            result += ` | ${traceCount} 个多轮对话`;
        }

        return result;
    };
    return (
        <div class="p-4 border-t border-gray-200 bg-gray-50">
            <div class="text-sm text-gray-600">{data()}</div>
        </div>
    );
};
// 定义 TraceList, RunsList, RunDetails 的 props 类型
interface TraceListProps {
    threads: Resource<TraceOverview[]>;
    traces: () => TraceOverview[];
    selectedThreadId: Accessor<string | null>;
    selectedTraceId: Accessor<string | null>;
    selectedSystem: Accessor<string>;
    searchQuery: Accessor<string>;
    onThreadSelect: (threadId: string) => void;
    onTraceSelect: (traceId: string) => void;
    onSystemChange: (system: string) => void;
    onSearchChange: (query: string) => void;
    onLoadThreads: () => void;
    refresh: () => void;
    refreshTrigger: Accessor<number>;
}
export const TraceList = (props: TraceListProps) => {
    // 移除前端过滤逻辑，直接使用传入的数据
    const filteredThreads = createMemo(() => {
        return props.threads() || [];
    });

    const filteredTraces = createMemo(() => {
        return props.traces() || [];
    });

    return (
        <div class="left-panel border-r border-gray-200 bg-white flex flex-col h-screen max-w-sm">
            {/* 搜索栏 */}
            <SearchBar
                searchQuery={props.searchQuery()}
                selectedSystem={props.selectedSystem()}
                onSearchChange={props.onSearchChange}
                onSystemChange={props.onSystemChange}
            />

            {/* 刷新按钮 */}
            <div class="p-2 border-b border-gray-200">
                <button
                    class="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
                    onClick={props.refresh}>
                    <RefreshCcw class="w-4 h-4 mr-2" />
                    刷新数据
                </button>
            </div>

            {/* 内容区域 */}
            <div class="flex-1 overflow-auto scrollbar">
                <div class="p-2 flex flex-col overflow-hidden h-full">
                    {/* 线程列表 */}
                    <ThreadList
                        threads={props.threads}
                        filteredThreads={filteredThreads}
                        selectedThreadId={props.selectedThreadId}
                        onThreadSelect={props.onThreadSelect}
                        onLoadThreads={props.onLoadThreads}
                    />

                    {/* Traces 列表 (当选择了线程时显示) */}
                    {props.selectedThreadId() ? (
                        <TracesSimpleList
                            traces={props.traces}
                            filteredTraces={filteredTraces}
                            selectedTraceId={props.selectedTraceId}
                            onTraceSelect={props.onTraceSelect}
                        />
                    ) : null}
                </div>
            </div>

            {/* 底部统计 */}
            <Statistics
                filteredThreads={filteredThreads}
                threads={props.threads}
                selectedThreadId={props.selectedThreadId}
                filteredTraces={filteredTraces}
            />
        </div>
    );
};
