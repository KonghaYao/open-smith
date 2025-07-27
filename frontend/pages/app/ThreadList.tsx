import type { Accessor, Resource } from "solid-js";
import type { TraceOverview } from "../../../src/types.js";
import { ThreadItem } from "./ThreadItem.jsx";

export const ThreadList = (props: {
    filteredThreads: () => TraceOverview[];
    threads: Resource<TraceOverview[]>;
    selectedThreadId: Accessor<string | null>;
    onThreadSelect: (threadId: string) => void;
    onLoadThreads: () => void;
}) => {
    const handleThreadClick = (threadId: string) => {
        props.onThreadSelect(threadId);
    };

    return (
        <div class="mb-3 flex-1 overflow-auto">
            <h3 class="text-sm font-medium text-gray-600 mb-2">
                🧵 会话列表 ({props.filteredThreads().length})
            </h3>
            {props.threads.loading && (
                <div class="loading text-center text-gray-500 py-4">
                    <div class="inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    <p class="mt-1 text-xs">加载线程中...</p>
                </div>
            )}
            {props.threads.error ? (
                <div class="text-red-500 text-center py-4">
                    <p class="text-sm">{props.threads.error}</p>
                    <button
                        onClick={props.onLoadThreads}
                        class="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">
                        重试
                    </button>
                </div>
            ) : null}
            {!props.threads.loading &&
                !props.threads.error &&
                props.filteredThreads().length === 0 && (
                    <div class="text-center text-gray-500 py-4">
                        <p class="text-sm">暂无线程数据</p>
                    </div>
                )}
            {!props.threads.loading &&
                !props.threads.error &&
                props.filteredThreads().length > 0 &&
                props
                    .filteredThreads()
                    .map((thread: any) => (
                        <ThreadItem
                            thread={thread}
                            isSelected={() =>
                                props.selectedThreadId() === thread.thread_id
                            }
                            onSelect={handleThreadClick}
                        />
                    ))}
        </div>
    );
};
