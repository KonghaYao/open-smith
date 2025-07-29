import { createSignal, createResource } from "solid-js";
import { TraceList } from "./TraceList.jsx";
import { RunsList } from "./RunsList.jsx";
import { RunDetails } from "./RunDetails.jsx";
import { createStoreSignal } from "../../utils.jsx";
import { ofetch } from "../../api.js";
import type { TraceInfo, TraceOverview } from "../../../src/types.js";
// 主 App 组件
export const App = () => {
    // 状态
    const [selectedThreadId, setSelectedThreadId] = createSignal<string | null>(
        null
    );
    const [selectedTraceId, setSelectedTraceId] = createSignal<string | null>(
        null
    );
    const [selectedRunId, setSelectedRunId] = createSignal<string | null>(null);
    const [selectedSystem, setSelectedSystem] = createStoreSignal(
        "selectedSystem",
        ""
    );

    // 刷新相关
    const [refreshTrigger, setRefreshTrigger] = createSignal(0);
    const refresh = () => setRefreshTrigger((t) => t + 1);

    // 搜索相关状态
    const [searchQuery, setSearchQuery] = createSignal("");
    const [limit, setLimit] = createSignal(50); // 新增 limit 状态，默认 100 条

    // 使用 createResource 获取线程概览列表
    const [allThreads, { refetch: refetchThreads }] = createResource(
        () => ({
            refresh: refreshTrigger(),
            system: selectedSystem(),
            search: searchQuery(),
            limit: limit(), // 传递 limit 参数
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

            if (params.limit) {
                queryParams.append("limit", params.limit.toString());
            }

            const response = await ofetch<{ threads: TraceOverview[] }>(
                `/trace/threads/overview?${queryParams.toString()}`
            );
            return response.threads || [];
        }
    );

    // 使用 createResource 获取选中线程的 traces - 改用新的搜索接口
    const [threadTraces, { refetch: refetchThreadTraces }] = createResource(
        () => ({ threadId: selectedThreadId(), refresh: refreshTrigger() }), // 依赖 refreshTrigger 触发刷新
        async (params) => {
            if (!params.threadId) return [];
            // 使用新的搜索接口
            const response = await ofetch<{ data: TraceOverview[] }>(
                `/trace/search/traces?thread_id=${encodeURIComponent(
                    params.threadId
                )}`
            );
            return response.data || [];
        }
    );

    // 使用 createResource 获取特定 trace 的数据
    const [currentTraceData, { refetch: refetchTraceData }] = createResource(
        () => ({ traceId: selectedTraceId(), refresh: refreshTrigger() }), // 依赖 refreshTrigger 触发刷新
        async (params) => {
            if (!params.traceId) return null;
            const response = await ofetch<TraceInfo>(
                `/trace/${params.traceId}`
            );
            return response;
        }
    );

    // 方法
    const handleThreadSelect = async (threadId: string | null) => {
        setSelectedThreadId(threadId);
        setSelectedTraceId(null);
        setSelectedRunId(null);
    };

    const handleTraceSelect = async (traceId: string | null) => {
        setSelectedTraceId(traceId);
        setSelectedRunId(null);
    };

    const handleRunSelect = (runId: string | null) => {
        setSelectedRunId(runId);
    };

    return (
        <div class="three-column h-screen flex flex-row bg-white overflow-hidden">
            <TraceList
                threads={allThreads}
                traces={() => threadTraces() || []}
                selectedThreadId={selectedThreadId}
                selectedTraceId={selectedTraceId}
                selectedSystem={selectedSystem}
                searchQuery={searchQuery}
                onThreadSelect={handleThreadSelect}
                onTraceSelect={handleTraceSelect}
                onSystemChange={setSelectedSystem}
                onSearchChange={setSearchQuery}
                onLoadThreads={refetchThreads}
                refresh={refresh}
                refreshTrigger={refreshTrigger}
            />
            <RunsList
                selectedTraceId={selectedTraceId}
                selectedRunId={selectedRunId}
                currentTraceData={() => currentTraceData() || null}
                onRunSelect={handleRunSelect}
                onLoadTrace={refetchTraceData}
                refresh={refresh}
                refreshTrigger={refreshTrigger}
            />
            <RunDetails
                selectedRunId={selectedRunId}
                currentTraceData={() => currentTraceData() || null}
                refresh={refresh}
                refreshTrigger={refreshTrigger}
            />
        </div>
    );
};
