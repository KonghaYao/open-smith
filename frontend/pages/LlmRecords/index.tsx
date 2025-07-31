import { type JSXElement } from "solid-js";
import { createSignal, createResource, For, Show, createMemo } from "solid-js";
import { RunDetailsPanel } from "./RunDetailsPanel.jsx";
import { DateRangePicker } from "./DateRangePicker.js";
import { ofetch } from "../../api.js";
import {
    formatDuration,
    formatTimestamp as formatUnixTimestamp,
} from "../../utils.js";
import { getColorFromString } from "../../utils/color.js";
import {
    ArrowLeft,
    ArrowRight,
    LoaderCircle,
    Info,
    RefreshCcw as RefreshCw,
    Search,
    Eraser,
    Copy,
    X,
} from "lucide-solid";
import type { RunRecord } from "../../../src/types.js";
import copy from "copy-to-clipboard";
import { A, Navigate } from "@solidjs/router";
// 定义类型接口
interface LlmRunFilters {
    run_type?: string;
    system?: string;
    model_name?: string;
    thread_id?: string;
    user_id?: string;
    start_time_after?: string; // 添加开始时间过滤
    start_time_before?: string; // 添加结束时间过滤
}

interface ColumnConfig {
    header: string;
    key: string | string[];
    format: (run: RunRecord) => JSXElement;
    className: string;
}

const formatTimeToFirstToken = (timeMs: number) => {
    if (!timeMs || timeMs <= 0) return "-";
    if (timeMs < 1000) return `${timeMs}ms`;
    return `${(timeMs / 1000).toFixed(2)}s`;
};

// 定义表格列的配置
const columnsConfig: ColumnConfig[] = [
    {
        header: "关联 ID",
        key: ["trace_id", "thread_id"],
        format: (run) => (
            <div class="space-y-1">
                <div class="flex items-center space-x-2">
                    <div class="text-xs text-gray-400 uppercase tracking-wide">
                        会话
                    </div>

                    {run.thread_id && (
                        <button
                            onClick={() => copy(run.thread_id!)}
                            class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            title="复制 会话 ID">
                            <Copy class="inline-block w-3 h-3 mr-1" />
                            复制
                        </button>
                    )}
                </div>
                <div class="text-sm font-mono text-gray-700 break-all">
                    {run.thread_id || "-"}{" "}
                    {run.thread_id && (
                        <A
                            href={`/?thread_id=${run.thread_id}`}
                            class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            title="查看会话">
                            <ArrowRight class="inline-block w-3 h-3 mr-1" />
                            查看
                        </A>
                    )}
                </div>
                <div class="flex items-center space-x-2">
                    <div class="text-xs text-gray-400 uppercase tracking-wide">
                        多轮对话 ID
                    </div>
                    {run.trace_id && (
                        <button
                            onClick={() => copy(run.trace_id!)}
                            class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            title="复制 多轮对话 ID">
                            <Copy class="inline-block w-3 h-3 mr-1" />
                            复制
                        </button>
                    )}
                </div>
                <div class="text-sm font-mono text-gray-700 break-all">
                    {run.trace_id || "-"}
                    {run.trace_id && (
                        <A
                            href={`/?thread_id=${run.thread_id}&trace_id=${run.trace_id}`}
                            class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            title="查看会话">
                            <ArrowRight class="inline-block w-3 h-3 mr-1" />
                            查看
                        </A>
                    )}
                </div>
            </div>
        ),
        className: "px-4 py-3 border-b border-gray-100",
    },
    {
        header: "运行详情",
        key: ["name", "system"],
        format: (run) => (
            <div class="space-y-1">
                <div class="text-xs text-gray-400 uppercase tracking-wide">
                    名称
                </div>
                <div class="text-sm font-medium text-gray-900">
                    {run.name || "-"}
                </div>
                <div class="text-xs text-gray-400 uppercase tracking-wide">
                    系统
                </div>
                <div
                    class={`text-sm text-gray-600 border rounded text-center w-fit px-2 ${getColorFromString(
                        run.system || ""
                    )}`}>
                    {run.system || "-"}
                </div>
            </div>
        ),
        className: "px-4 py-3 border-b border-gray-100",
    },
    {
        header: "模型名称",
        key: "model_name",
        format: (run) => (
            <span
                class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getColorFromString(
                    run.model_name || ""
                )}`}>
                {run.model_name || "-"}
            </span>
        ),
        className: "px-4 py-3 border-b border-gray-100",
    },
    {
        header: "内容",
        key: "outputs",
        format: (run) => {
            let message = "";
            try {
                const content = JSON.parse(
                    run.outputs || "{}"
                ).generations?.[0]?.map((i: any) => i.message)[0].kwargs
                    .content;
                if (typeof content === "string") {
                    message = content;
                } else if (Array.isArray(content)) {
                    message =
                        content.find((i: any) => i.type === "text")?.text ||
                        "-";
                } else {
                    message = "-";
                }
            } catch (e) {
                message = "-";
            }
            return (
                <span
                    class="block items-center px-2.5 py-0.5 rounded-full text-xs font-medium overflow-hidden text-ellipsis max-w-40 max-w-[10rem] whitespace-normal leading-[1.4em] h-[2.8em]"
                    title={message}>
                    {message}
                </span>
            );
        },
        className: "px-4 py-3 border-b border-gray-100",
    },
    {
        header: "首字时间",
        key: "time_to_first_token",
        format: (run) => (
            <span class="text-sm font-mono text-gray-700">
                {formatTimeToFirstToken(run.time_to_first_token!)}
            </span>
        ),
        className: "px-4 py-3 border-b border-gray-100 text-center",
    },
    {
        header: "生成时长",
        key: ["start_time", "end_time"],
        format: (run) => (
            <span class="text-sm font-mono text-gray-700">
                {formatDuration(
                    run.start_time.toString(),
                    run.end_time?.toString()
                )}
            </span>
        ),
        className: "px-4 py-3 border-b border-gray-100 text-center",
    },
    {
        header: "总 Token",
        key: "total_tokens",
        format: (run) => (
            <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                {(run.total_tokens || 0).toLocaleString()}
            </span>
        ),
        className: "px-4 py-3 border-b border-gray-100 text-center",
    },
    {
        header: "用户 ID",
        key: "user_id",
        format: (run) => (
            <span
                class={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getColorFromString(
                    run.user_id || ""
                )}`}>
                {run.user_id || "-"}
            </span>
        ),
        className: "px-4 py-3 border-b border-gray-100 text-center",
    },
    {
        header: "起始时间",
        key: "start_time",
        format: (run) => (
            <span class="text-sm text-gray-600">
                {formatUnixTimestamp(run.start_time.toString())}
            </span>
        ),
        className: "px-4 py-3 border-b border-gray-100",
    },
];

// 获取系统列表
const fetchSystems = async () => {
    try {
        const response = await ofetch("/trace/systems");
        return response.success ? response.systems : [];
    } catch (e) {
        console.error("Failed to fetch systems:", e);
        return [];
    }
};

// 获取模型名称列表
const fetchModelNames = async () => {
    try {
        const response = await ofetch("/trace/models");
        return response.success ? response.model_names : [];
    } catch (e) {
        console.error("Failed to fetch model names:", e);
        return [];
    }
};

const fetchLlmRuns = async ([currentPage, itemsPerPage, filters]: [
    number,
    number,
    LlmRunFilters
]) => {
    const offset = (currentPage - 1) * itemsPerPage;

    // 构建查询参数
    const queryParams = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: offset.toString(),
    });

    // 添加过滤条件
    if (filters.run_type) queryParams.append("run_type", filters.run_type);
    if (filters.system) queryParams.append("system", filters.system);
    if (filters.model_name)
        queryParams.append("model_name", filters.model_name);
    if (filters.thread_id) queryParams.append("thread_id", filters.thread_id);
    if (filters.user_id) queryParams.append("user_id", filters.user_id);
    if (filters.start_time_after)
        queryParams.append("start_time_after", filters.start_time_after);
    if (filters.start_time_before)
        queryParams.append("start_time_before", filters.start_time_before);

    try {
        // 使用新的搜索接口
        const response = await ofetch<RunDataResponse>(
            `/trace/search/runs?${queryParams.toString()}`
        );
        if (response.success && Array.isArray(response.data)) {
            return {
                runs: response.data as RunRecord[],
                total: response.total as number,
            };
        } else {
            throw new Error("Invalid data format from API.");
        }
    } catch (e) {
        console.error("Failed to fetch LLM runs:", e);
        throw e;
    }
};

interface RunDataResponse {
    success: boolean;
    data: RunRecord[];
    total: number;
}

export const LlmRecords = () => {
    const [currentPage, setCurrentPage] = createSignal(1);
    const [itemsPerPage, setItemsPerPage] = createSignal(10);

    // 过滤条件
    const [filters, setFilters] = createSignal<LlmRunFilters>({
        run_type: "llm", // 默认查询 LLM runs
        system: "",
        model_name: "",
        thread_id: "",
        user_id: "", // 添加 user_id 过滤条件
        start_time_after: "", // 初始化
        start_time_before: "", // 初始化
    });

    // 临时过滤条件（用于输入）
    const [tempFilters, setTempFilters] = createSignal<LlmRunFilters>({
        run_type: "llm",
        system: "",
        model_name: "",
        thread_id: "",
        user_id: "", // 添加 user_id 临时过滤条件
        start_time_after: "", // 初始化
        start_time_before: "", // 初始化
    });

    // 资源加载
    const [systemsResource] = createResource<string[]>(fetchSystems);
    const [modelNamesResource] = createResource<string[]>(fetchModelNames);

    const [llmRunsResource, { refetch: refetchLlmRuns }] = createResource(
        async () => {
            const [currentP, itemsP, filtersA] = [
                currentPage(),
                itemsPerPage(),
                filters(),
            ];
            return await fetchLlmRuns([currentP, itemsP, filtersA]);
        }
    );

    const totalRunsCount = createMemo(() => {
        const runsData = llmRunsResource();
        return runsData?.total ?? 0;
    });

    const totalPages = createMemo(() => {
        return Math.ceil(totalRunsCount() / itemsPerPage());
    });

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(1, prev - 1));
        refetchLlmRuns(); // 强制刷新数据
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(totalPages(), prev + 1));
        refetchLlmRuns(); // 强制刷新数据
    };

    const [selectedRun, setSelectedRun] = createSignal<RunRecord | null>(null);

    const handleRowClick = (run: RunRecord) => {
        setSelectedRun(run);
    };

    // 处理临时过滤条件变化
    const handleTempFilterChange = (
        field: keyof LlmRunFilters,
        value: string
    ) => {
        setTempFilters((prev) => ({ ...prev, [field]: value }));
    };

    // 执行搜索
    const handleSearch = () => {
        setFilters(tempFilters());
        setCurrentPage(1); // 重置到第一页
        refetchLlmRuns(); // 强制刷新数据
    };

    // 清除过滤条件
    const handleClearFilters = () => {
        const defaultFilters: LlmRunFilters = {
            run_type: "llm",
            system: "",
            model_name: "",
            thread_id: "",
            user_id: "", // 清除 user_id 过滤条件
            start_time_after: "", // 清除时间过滤
            start_time_before: "", // 清除时间过滤
        };
        setTempFilters(defaultFilters);
        setFilters(defaultFilters);
        setCurrentPage(1);
    };

    return (
        <div class="min-h-screen bg-gray-50">
            {/* 顶部导航栏 */}
            <header class="bg-white border-b border-gray-200">
                <div class="px-6 py-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <h1 class="text-2xl font-bold text-gray-900">
                                追踪概览
                            </h1>
                            <div class="h-6 w-px bg-gray-300"></div>
                            <span class="text-sm text-gray-500">
                                运行数据监控面板
                            </span>
                        </div>
                        <button
                            onClick={refetchLlmRuns}
                            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                            <RefreshCw class="w-4 h-4 mr-2" />
                            刷新数据
                        </button>
                    </div>
                </div>
            </header>

            {/* 主要内容区域 */}
            <main class="flex-1 px-6 py-6">
                {/* 过滤条件卡片 */}
                <div class="bg-white rounded-lg border border-gray-200 mb-4">
                    <div class="px-4 py-3 border-b border-gray-200">
                        <h3 class="text-md font-medium text-gray-900">
                            过滤条件
                        </h3>
                    </div>
                    <div class="p-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    运行类型
                                </label>
                                <select
                                    class="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    value={tempFilters().run_type}
                                    onChange={(e) =>
                                        handleTempFilterChange(
                                            "run_type",
                                            e.currentTarget.value
                                        )
                                    }>
                                    <option value="">全部类型</option>
                                    <option value="llm">LLM 运行</option>
                                    <option value="chain">链式运行</option>
                                    <option value="tool">工具运行</option>
                                    <option value="retriever">检索运行</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    系统
                                </label>
                                <select
                                    class="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    value={tempFilters().system}
                                    onChange={(e) =>
                                        handleTempFilterChange(
                                            "system",
                                            e.currentTarget.value
                                        )
                                    }>
                                    <option value="">全部系统</option>
                                    <For each={systemsResource()}>
                                        {(system: string) => (
                                            <option value={system}>
                                                {system}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    模型
                                </label>
                                <select
                                    class="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    value={tempFilters().model_name}
                                    onChange={(e) =>
                                        handleTempFilterChange(
                                            "model_name",
                                            e.currentTarget.value
                                        )
                                    }>
                                    <option value="">全部模型</option>
                                    <For each={modelNamesResource()}>
                                        {(modelName: string) => (
                                            <option value={modelName}>
                                                {modelName}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    会话 ID
                                </label>
                                <input
                                    type="text"
                                    class="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    placeholder="请输入会话 ID..."
                                    value={tempFilters().thread_id}
                                    onInput={(e) =>
                                        handleTempFilterChange(
                                            "thread_id",
                                            e.currentTarget.value
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    用户ID
                                </label>
                                <input
                                    type="text"
                                    class="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    placeholder="请输入用户ID..."
                                    value={tempFilters().user_id}
                                    onInput={(e) =>
                                        handleTempFilterChange(
                                            "user_id",
                                            e.currentTarget.value
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    起始时间 (起)
                                </label>
                                <DateRangePicker
                                    startTime={tempFilters().start_time_after!}
                                    endTime={tempFilters().start_time_before!}
                                    onStartTimeChange={(value) =>
                                        handleTempFilterChange(
                                            "start_time_after",
                                            value
                                        )
                                    }
                                    onEndTimeChange={(value) =>
                                        handleTempFilterChange(
                                            "start_time_before",
                                            value
                                        )
                                    }
                                />
                            </div>
                        </div>
                        <div class="mt-4 flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                                <button
                                    onClick={handleSearch}
                                    class="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                                    <Search class="w-4 h-4 mr-2" />
                                    搜索
                                </button>
                                <button
                                    onClick={handleClearFilters}
                                    class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                                    <Eraser class="w-4 h-4 mr-2" />
                                    清除
                                </button>
                            </div>
                            <div class="text-xs text-gray-500">
                                当前筛选结果：
                                <span class="font-medium">
                                    {totalRunsCount()}
                                </span>
                                条记录
                            </div>
                        </div>
                    </div>
                </div>

                {/* 数据表格和详情面板 */}
                <div class="flex gap-6 h-auto">
                    {/* 数据表格 */}
                    <div class="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div class="px-6 py-4 border-b border-gray-200">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="text-lg font-medium text-gray-900">
                                        运行记录
                                    </h3>
                                    <p class="mt-1 text-sm text-gray-500">
                                        点击行查看详细信息
                                    </p>
                                </div>
                                <div class="flex items-center text-sm text-gray-500">
                                    <span>共 {totalRunsCount()} 条记录</span>
                                </div>
                            </div>
                        </div>

                        <div class="overflow-auto" style="max-height: 600px;">
                            <Show
                                when={
                                    llmRunsResource.loading ||
                                    llmRunsResource.error ||
                                    !llmRunsResource()?.runs
                                }>
                                <div class="p-8 text-center">
                                    <Show
                                        when={llmRunsResource.loading}
                                        fallback={
                                            <Show
                                                when={llmRunsResource.error}
                                                fallback={
                                                    <div class="text-center">
                                                        <Info class="mx-auto h-12 w-12 text-gray-400" />
                                                        <h3 class="mt-2 text-sm font-medium text-gray-900">
                                                            暂无数据
                                                        </h3>
                                                        <p class="mt-1 text-sm text-gray-500">
                                                            当前筛选条件下没有找到运行记录
                                                        </p>
                                                    </div>
                                                }>
                                                <div class="text-center">
                                                    <X class="mx-auto h-12 w-12 text-red-400" />
                                                    <h3 class="mt-2 text-sm font-medium text-gray-900">
                                                        加载错误
                                                    </h3>
                                                    <p class="mt-1 text-sm text-gray-500">
                                                        {
                                                            llmRunsResource
                                                                .error?.message
                                                        }
                                                    </p>
                                                </div>
                                            </Show>
                                        }>
                                        <div class="inline-flex items-center">
                                            <LoaderCircle class="w-4 h-4 mr-2 animate-spin" />
                                            <span class="text-gray-600">
                                                正在加载数据...
                                            </span>
                                        </div>
                                    </Show>
                                </div>
                            </Show>
                            <Show
                                when={
                                    !llmRunsResource.loading &&
                                    !llmRunsResource.error &&
                                    llmRunsResource()?.runs
                                }>
                                <table class="min-w-full divide-y divide-gray-200">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <For each={columnsConfig}>
                                                {(col: ColumnConfig) => (
                                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                                        {col.header}
                                                    </th>
                                                )}
                                            </For>
                                        </tr>
                                    </thead>
                                    <tbody class="bg-white divide-y divide-gray-200">
                                        <For each={llmRunsResource()?.runs}>
                                            {(run) => (
                                                <tr
                                                    class="hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100"
                                                    onClick={() =>
                                                        handleRowClick(run)
                                                    }>
                                                    <For each={columnsConfig}>
                                                        {(
                                                            col: ColumnConfig
                                                        ) => (
                                                            <td
                                                                class={
                                                                    col.className
                                                                }>
                                                                {col.format(
                                                                    run
                                                                )}
                                                            </td>
                                                        )}
                                                    </For>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </Show>
                        </div>

                        {/* 分页控件 */}
                        <Show
                            when={!llmRunsResource.loading && totalPages() > 0}>
                            <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
                                <div class="flex items-center justify-between">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={
                                            currentPage() === 1 ||
                                            llmRunsResource.loading
                                        }
                                        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                        <ArrowLeft class="w-4 h-4 mr-2" />
                                        上一页
                                    </button>

                                    <div class="flex items-center space-x-2">
                                        <span class="text-sm text-gray-700">
                                            第
                                            <span class="font-medium">
                                                {currentPage()}
                                            </span>
                                            页，共
                                            <span class="font-medium">
                                                {totalPages()}
                                            </span>
                                            页
                                        </span>
                                        <div class="h-4 w-px bg-gray-300"></div>
                                        <span class="text-sm text-gray-500">
                                            总计
                                            <span class="font-medium">
                                                {totalRunsCount()}
                                            </span>
                                            条记录
                                        </span>
                                    </div>

                                    <button
                                        onClick={handleNextPage}
                                        disabled={
                                            currentPage() === totalPages() ||
                                            llmRunsResource.loading
                                        }
                                        class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                        下一页
                                        <ArrowRight class="w-4 h-4 ml-2" />
                                    </button>
                                </div>
                            </div>
                        </Show>
                    </div>

                    {/* 右侧详情面板 */}
                    <Show when={selectedRun()}>
                        {
                            <RunDetailsPanel
                                run={selectedRun()!}
                                onClose={() => setSelectedRun(null)}
                            />
                        }
                    </Show>
                </div>
            </main>
        </div>
    );
};
