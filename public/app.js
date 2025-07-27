import { createSignal, createResource, onMount } from "solid-js";
import html from "solid-js/html";
import { TraceList } from "./components/TraceList.js";
import { RunsList } from "./components/RunsList.js";
import { RunDetails } from "./components/RunDetails.js";
import { createStoreSignal } from "./utils.js";

// 主 App 组件
export const App = () => {
    // 状态
    const [selectedThreadId, setSelectedThreadId] = createSignal(null);
    const [selectedTraceId, setSelectedTraceId] = createSignal(null);
    const [selectedRunId, setSelectedRunId] = createSignal(null);
    const [selectedSystem, setSelectedSystem] = createStoreSignal(
        "selectedSystem",
        "",
    );

    // 刷新相关
    const [refreshTrigger, setRefreshTrigger] = createSignal(0);
    const refresh = () => setRefreshTrigger((t) => t + 1);

    // 搜索相关状态
    const [searchQuery, setSearchQuery] = createSignal("");

    // 使用 createResource 获取线程概览列表
    const [allThreads, { refetch: refetchThreads }] = createResource(
        () => ({
            refresh: refreshTrigger(),
            system: selectedSystem(),
            search: searchQuery(),
        }), // 依赖 refreshTrigger、selectedSystem 和 search 触发刷新
        async (params) => {
            // 构建查询参数
            const queryParams = new URLSearchParams();

            if (params.system) {
                queryParams.append("system", params.system);
            }

            if (params.search && params.search.trim()) {
                queryParams.append("thread_id", params.search.trim());
            }

            // 使用线程概览接口
            const url = `../trace/threads/overview?${queryParams.toString()}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to load threads");
            const data = await response.json();
            return data.threads || [];
        },
    );

    // 使用 createResource 获取选中线程的 traces - 改用新的搜索接口
    const [threadTraces, { refetch: refetchThreadTraces }] = createResource(
        () => ({ threadId: selectedThreadId(), refresh: refreshTrigger() }), // 依赖 refreshTrigger 触发刷新
        async (params) => {
            if (!params.threadId) return [];
            // 使用新的搜索接口
            const response = await fetch(
                `../trace/search/traces?thread_id=${encodeURIComponent(
                    params.threadId,
                )}`,
            );
            if (!response.ok) throw new Error("Failed to load thread traces");
            const data = await response.json();
            return data.data || [];
        },
    );

    // 使用 createResource 获取特定 trace 的数据
    const [currentTraceData, { refetch: refetchTraceData }] = createResource(
        () => ({ traceId: selectedTraceId(), refresh: refreshTrigger() }), // 依赖 refreshTrigger 触发刷新
        async (params) => {
            if (!params.traceId) return null;
            const response = await fetch(`../trace/${params.traceId}`);
            if (!response.ok) throw new Error("Failed to load trace data");
            return await response.json();
        },
    );

    // 方法
    const handleThreadSelect = async (threadId) => {
        setSelectedThreadId(threadId);
        setSelectedTraceId(null);
        setSelectedRunId(null);
    };

    const handleTraceSelect = async (traceId) => {
        setSelectedTraceId(traceId);
        setSelectedRunId(null);
    };

    const handleRunSelect = (runId) => {
        setSelectedRunId(runId);
    };

    return html`
        <div
            class="three-column h-screen flex flex-row bg-white overflow-hidden"
        >
            ${TraceList({
                threads: allThreads,
                traces: threadTraces,
                selectedThreadId,
                selectedTraceId,
                selectedSystem,
                searchQuery,
                onThreadSelect: handleThreadSelect,
                onTraceSelect: handleTraceSelect,
                onSystemChange: setSelectedSystem,
                onSearchChange: setSearchQuery,
                onLoadThreads: refetchThreads,
                onLoadTraces: refetchThreadTraces,
                refresh: refresh, // 传递 refresh 方法
                refreshTrigger: refreshTrigger, // 传递 refreshTrigger 信号
            })}
            ${RunsList({
                selectedTraceId,
                selectedRunId,
                currentTraceData,
                onRunSelect: handleRunSelect,
                onLoadTrace: refetchTraceData,
                refresh: refresh, // 传递 refresh 方法
                refreshTrigger: refreshTrigger, // 传递 refreshTrigger 信号
            })}
            ${RunDetails({
                selectedRunId,
                currentTraceData,
                refresh: refresh, // 传递 refresh 方法
                refreshTrigger: refreshTrigger, // 传递 refreshTrigger 信号
            })}
        </div>
    `;
};
