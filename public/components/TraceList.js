import { createSignal, createMemo } from "solid-js";
import html from "solid-js/html";
import { SearchBar } from "./SearchBar.js";
import { ThreadList } from "./ThreadList.js";
import { TracesSimpleList } from "./TracesSimpleList.js";
import { Statistics } from "./Statistics.js";

export const TraceList = (props) => {
    // 移除前端过滤逻辑，直接使用传入的数据
    const filteredThreads = createMemo(() => {
        return props.threads() || [];
    });

    const filteredTraces = createMemo(() => {
        return props.traces() || [];
    });

    return html`
        <div
            class="left-panel border-r border-gray-200 bg-white flex flex-col h-screen max-w-sm"
        >
            <!-- 搜索栏 -->
            ${SearchBar({
                searchQuery: props.searchQuery,
                selectedSystem: props.selectedSystem,
                onSearchChange: props.onSearchChange,
                onSystemChange: props.onSystemChange,
            })}

            <!-- 刷新按钮 -->
            <div class="p-2 border-b border-gray-200">
                <button
                    class="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
                    onclick=${props.refresh}
                >
                    <svg
                        class="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        ></path>
                    </svg>
                    刷新数据
                </button>
            </div>

            <!-- 内容区域 -->
            <div class="flex-1 overflow-auto scrollbar">
                <div class="p-2 flex flex-col overflow-hidden h-full">
                    <!-- 线程列表 -->
                    ${ThreadList({
                        threads: props.threads,
                        filteredThreads,
                        selectedThreadId: props.selectedThreadId,
                        onThreadSelect: props.onThreadSelect,
                        onLoadThreads: props.onLoadThreads,
                    })}

                    <!-- Traces 列表 (当选择了线程时显示) -->
                    ${() =>
                        props.selectedThreadId()
                            ? TracesSimpleList({
                                  traces: props.traces,
                                  filteredTraces,
                                  selectedTraceId: props.selectedTraceId,
                                  onTraceSelect: props.onTraceSelect,
                                  onLoadTraces: props.onLoadTraces,
                              })
                            : ""}
                </div>
            </div>

            <!-- 底部统计 -->
            ${Statistics({
                filteredThreads,
                threads: props.threads,
                selectedSystem: props.selectedSystem,
                selectedThreadId: props.selectedThreadId,
                filteredTraces,
            })}
        </div>
    `;
};
