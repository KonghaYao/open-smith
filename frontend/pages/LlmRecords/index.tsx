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
    CheckCircle,
    XCircle,
    MessageSquare,
    Paperclip,
    Tag,
    AlertCircle,
    TrendingUp,
    BarChart3,
    Zap,
    Eye,
    EyeOff,
    Settings2,
    ChevronDown,
    ChevronUp,
} from "lucide-solid";
import type { RunRecord } from "../../../src/types.js";
import copy from "copy-to-clipboard";
import { A, useSearchParams } from "@solidjs/router";

// 时间计算函数
const threeDaysAgo = (): Date => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d;
};

const todayEnd = (): Date => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
};

// 定义类型接口
interface LlmRunFilters {
    run_type?: string;
    system?: string;
    model_name?: string;
    thread_id?: string;
    user_id?: string;
    start_time_after?: string;
    start_time_before?: string;
    has_error?: boolean;
    has_feedback?: boolean;
    min_tokens?: number;
    max_tokens?: number;
    min_duration_ms?: number;
    max_duration_ms?: number;
}

interface ColumnConfig {
    id: string;
    header: string;
    key: string | string[];
    format: (run: RunRecord) => JSXElement;
    className: string;
    defaultVisible: boolean;
}

// 所有可用的列配置
const allColumnsConfig: ColumnConfig[] = [
    {
        id: "association",
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
                            title="复制 会话 ID"
                        >
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
                            title="查看会话"
                        >
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
                            title="复制 多轮对话 ID"
                        >
                            <Copy class="inline-block w-3 h-3 mr-1" />
                            复制
                        </button>
                    )}
                </div>
                <div class="text-sm font-mono text-gray-700 break-all">
                    {run.trace_id || "-"}
                    {run.trace_id && run.thread_id && (
                        <A
                            href={`/?thread_id=${run.thread_id}&trace_id=${run.trace_id}`}
                            class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                            title="查看会话"
                        >
                            <ArrowRight class="inline-block w-3 h-3 mr-1" />
                            查看
                        </A>
                    )}
                </div>
            </div>
        ),
        className: "px-3 py-2 border-b border-gray-100",
        defaultVisible: true,
    },
    {
        id: "run_id",
        header: "运行 ID",
        key: "id",
        format: (run) => (
            <div class="flex items-center space-x-1">
                <span class="text-xs font-mono text-gray-700 truncate max-w-24">
                    {run.id}
                </span>
                <button
                    onClick={() => copy(run.id)}
                    class="text-gray-400 hover:text-gray-700 transition-colors"
                    title="复制 ID"
                >
                    <Copy class="w-3 h-3" />
                </button>
            </div>
        ),
        className: "px-3 py-2 border-b border-gray-100",
        defaultVisible: false,
    },
    {
        id: "run_details",
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
                        run.system || "",
                    )}`}
                >
                    {run.system || "-"}
                </div>
            </div>
        ),
        className: "px-3 py-2 border-b border-gray-100",
        defaultVisible: true,
    },
    {
        id: "run_type",
        header: "运行类型",
        key: "run_type",
        format: (run) => {
            const typeColors: Record<string, string> = {
                llm: "bg-blue-100 text-blue-800 border-blue-200",
                chain: "bg-purple-100 text-purple-800 border-purple-200",
                tool: "bg-green-100 text-green-800 border-green-200",
                retriever: "bg-orange-100 text-orange-800 border-orange-200",
            };
            const colorClass = typeColors[run.run_type || ""] || "bg-gray-100 text-gray-800 border-gray-200";
            return (
                <span
                    class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
                >
                    {run.run_type || "-"}
                </span>
            );
        },
        className: "px-3 py-2 border-b border-gray-100 text-center",
        defaultVisible: false,
    },
    {
        id: "model_name",
        header: "模型名称",
        key: "model_name",
        format: (run) => (
            <span
                class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getColorFromString(
                    run.model_name || "",
                )}`}
            >
                {run.model_name || "-"}
            </span>
        ),
        className: "px-4 py-3 border-b border-gray-100 text-center",
        defaultVisible: true,
    },
    {
        id: "status",
        header: "状态",
        key: ["error", "feedback_count", "attachments_count"],
        format: (run) => (
            <div class="flex flex-wrap gap-1 items-center justify-center">
                {run.error ? (
                    <div
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200"
                        title="运行失败"
                    >
                        <XCircle class="w-3 h-3 mr-1" />
                        失败
                    </div>
                ) : (
                    <div
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200"
                        title="运行成功"
                    >
                        <CheckCircle class="w-3 h-3 mr-1" />
                        成功
                    </div>
                )}
                {run.feedback_count > 0 && (
                    <div
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                        title={`收到 ${run.feedback_count} 条反馈`}
                    >
                        <MessageSquare class="w-3 h-3 mr-1" />
                        {run.feedback_count}
                    </div>
                )}
                {run.attachments_count > 0 && (
                    <div
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
                        title={`包含 ${run.attachments_count} 个附件`}
                    >
                        <Paperclip class="w-3 h-3 mr-1" />
                        {run.attachments_count}
                    </div>
                )}
            </div>
        ),
        className: "px-3 py-2 border-b border-gray-100 text-center",
        defaultVisible: true,
    },
    {
        id: "error_message",
        header: "错误信息",
        key: "error",
        format: (run) => {
            if (!run.error) return <span class="text-xs text-gray-400">-</span>;
            const errorStr = typeof run.error === "string" ? run.error : JSON.stringify(run.error);
            return (
                <div
                    class="text-xs text-red-600 max-w-32 truncate"
                    title={errorStr}
                >
                    {errorStr}
                </div>
            );
        },
        className: "px-3 py-2 border-b border-gray-100",
        defaultVisible: false,
    },
    {
        id: "content",
        header: "内容",
        key: "outputs",
        format: (run) => {
            let message = "";
            try {
                const content = JSON.parse(
                    run.outputs || "{}",
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
                    title={message}
                >
                    {message}
                </span>
            );
        },
        className: "px-3 py-2 border-b border-gray-100",
        defaultVisible: false,
    },
    {
        id: "io_size",
        header: "输入/输出",
        key: ["inputs", "outputs"],
        format: (run) => {
            const formatLength = (obj: Record<string, any> | undefined): string => {
                if (!obj) return "-";
                try {
                    const jsonStr = JSON.stringify(obj);
                    const length = jsonStr.length;
                    return length > 1000 ? `${(length / 1000).toFixed(1)}K` : `${length}`;
                } catch {
                    return "-";
                }
            };
            return (
                <div class="text-xs space-y-1">
                    <div class="flex items-center">
                        <span class="text-gray-400 mr-1">入:</span>
                        <span class="font-mono text-gray-600">{formatLength(run.inputs as any)}</span>
                    </div>
                    <div class="flex items-center">
                        <span class="text-gray-400 mr-1">出:</span>
                        <span class="font-mono text-gray-600">{formatLength(run.outputs as any)}</span>
                    </div>
                </div>
            );
        },
        className: "px-3 py-2 border-b border-gray-100 text-center",
        defaultVisible: true,
    },
    {
        id: "performance",
        header: "性能指标",
        key: ["time_to_first_token", "total_tokens", "start_time", "end_time"],
        format: (run) => {
            const calculateThroughput = (run: RunRecord): number => {
                if (!run.total_tokens || !run.start_time || !run.end_time) return 0;
                const startTime = new Date(run.start_time).getTime();
                const endTime = new Date(run.end_time).getTime();
                const durationSeconds = (endTime - startTime) / 1000;
                if (durationSeconds <= 0) return 0;
                return Math.round(run.total_tokens / durationSeconds);
            };
            const formatTimeToFirstToken = (timeMs: number) => {
                if (!timeMs || timeMs <= 0) return "-";
                if (timeMs < 1000) return `${timeMs}ms`;
                return `${(timeMs / 1000).toFixed(2)}s`;
            };
            const throughput = calculateThroughput(run);
            const duration = run.start_time && run.end_time
                ? new Date(run.end_time).getTime() - new Date(run.start_time).getTime()
                : 0;
            return (
                <div class="text-xs space-y-1">
                    <div class="flex items-center justify-center gap-2">
                        <span class="text-gray-400">TTFT:</span>
                        <span class="font-mono text-gray-700">{formatTimeToFirstToken(run.time_to_first_token!)}</span>
                    </div>
                    <div class="flex items-center justify-center gap-2">
                        <span class="text-gray-400">总时:</span>
                        <span class="font-mono text-gray-700">{duration > 0 ? `${(duration / 1000).toFixed(2)}s` : "-"}</span>
                    </div>
                    {throughput > 0 && (
                        <div class="flex items-center justify-center gap-2">
                            <Zap class="w-3 h-3 text-yellow-500" />
                            <span class="font-mono text-yellow-700">{throughput}/s</span>
                        </div>
                    )}
                </div>
            );
        },
        className: "px-3 py-2 border-b border-gray-100 text-center",
        defaultVisible: true,
    },
    {
        id: "tokens",
        header: "Token 统计",
        key: "total_tokens",
        format: (run) => (
            <div class="flex flex-col items-center">
                <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 mb-1">
                    <TrendingUp class="w-3 h-3 mr-1" />
                    {(run.total_tokens || 0).toLocaleString()}
                </span>
                <span class="text-xs text-gray-400">total</span>
            </div>
        ),
        className: "px-3 py-2 border-b border-gray-100 text-center",
        defaultVisible: true,
    },
    {
        id: "tags",
        header: "标签",
        key: "tags",
        format: (run) => {
            const getTags = (run: RunRecord): string[] => {
                if (!run.tags) return [];
                try {
                    const tags = JSON.parse(run.tags);
                    return Array.isArray(tags) ? tags : [];
                } catch {
                    return [];
                }
            };
            const tags = getTags(run);
            if (tags.length === 0) {
                return <span class="text-xs text-gray-400">-</span>;
            }
            return (
                <div class="flex flex-wrap gap-1 justify-center max-w-32">
                    {tags.slice(0, 3).map((tag, idx) => (
                        <span
                            key={idx}
                            class={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${getColorFromString(
                                tag,
                            )}`}
                        >
                            <Tag class="w-2.5 h-2.5 mr-0.5" />
                            {tag.length > 8 ? `${tag.substring(0, 8)}...` : tag}
                        </span>
                    ))}
                    {tags.length > 3 && (
                        <span class="text-xs text-gray-400">+{tags.length - 3}</span>
                    )}
                </div>
            );
        },
        className: "px-3 py-2 border-b border-gray-100 text-center",
        defaultVisible: false,
    },
    {
        id: "user_id",
        header: "用户 ID",
        key: "user_id",
        format: (run) => (
            <span
                class={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getColorFromString(
                    run.user_id || "",
                )}`}
            >
                {run.user_id || "-"}
            </span>
        ),
        className: "px-4 py-3 border-b border-gray-100 text-center",
        defaultVisible: true,
    },
    {
        id: "start_time",
        header: "起始时间",
        key: "start_time",
        format: (run) => (
            <span class="text-sm text-gray-600">
                {formatUnixTimestamp(run.start_time.toString())}
            </span>
        ),
        className: "px-3 py-2 border-b border-gray-100",
        defaultVisible: true,
    },
    {
        id: "end_time",
        header: "结束时间",
        key: "end_time",
        format: (run) => (
            <span class="text-sm text-gray-600">
                {run.end_time ? formatUnixTimestamp(run.end_time.toString()) : "-"}
            </span>
        ),
        className: "px-3 py-2 border-b border-gray-100",
        defaultVisible: false,
    },
    {
        id: "created_at",
        header: "创建时间",
        key: "created_at",
        format: (run) => (
            <span class="text-xs text-gray-500">
                {formatUnixTimestamp(run.created_at.toString())}
            </span>
        ),
        className: "px-3 py-2 border-b border-gray-100",
        defaultVisible: false,
    },
    {
        id: "updated_at",
        header: "更新时间",
        key: "updated_at",
        format: (run) => (
            <span class="text-xs text-gray-500">
                {formatUnixTimestamp(run.updated_at.toString())}
            </span>
        ),
        className: "px-3 py-2 border-b border-gray-100",
        defaultVisible: false,
    },
    {
        id: "feedback_score",
        header: "反馈评分",
        key: "feedback_count",
        format: (run) => {
            if (!run.feedback || run.feedback.length === 0) {
                return <span class="text-xs text-gray-400">-</span>;
            }
            const scores = run.feedback
                .map(f => f.score)
                .filter(s => s !== undefined) as number[];
            if (scores.length === 0) {
                return <span class="text-xs text-gray-400">-</span>;
            }
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            const scoreColor = avgScore >= 4 ? "text-green-600" : avgScore >= 2 ? "text-yellow-600" : "text-red-600";
            return (
                <div class="text-center">
                    <span class={`text-lg font-bold ${scoreColor}`}>
                        {avgScore.toFixed(1)}
                    </span>
                    <div class="text-xs text-gray-400">
                        / 5 ({scores.length} 个评分)
                    </div>
                </div>
            );
        },
        className: "px-3 py-2 border-b border-gray-100 text-center",
        defaultVisible: false,
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
    LlmRunFilters,
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
            `/trace/search/runs?${queryParams.toString()}`,
        );
        if (response.success && Array.isArray(response.data)) {
            let filteredData = response.data as RunRecord[];

            // 客户端额外过滤
            if (filters.has_error !== undefined) {
                filteredData = filteredData.filter(run => {
                    return filters.has_error ? !!run.error : !run.error;
                });
            }
            if (filters.has_feedback !== undefined) {
                filteredData = filteredData.filter(run => {
                    return filters.has_feedback ? run.feedback_count > 0 : run.feedback_count === 0;
                });
            }
            if (filters.min_tokens !== undefined) {
                filteredData = filteredData.filter(run => {
                    return (run.total_tokens || 0) >= filters.min_tokens!;
                });
            }
            if (filters.max_tokens !== undefined) {
                filteredData = filteredData.filter(run => {
                    return (run.total_tokens || 0) <= filters.max_tokens!;
                });
            }
            if (filters.min_duration_ms !== undefined || filters.max_duration_ms !== undefined) {
                filteredData = filteredData.filter(run => {
                    if (!run.start_time || !run.end_time) return false;
                    const duration = new Date(run.end_time).getTime() - new Date(run.start_time).getTime();
                    if (filters.min_duration_ms && duration < filters.min_duration_ms) return false;
                    if (filters.max_duration_ms && duration > filters.max_duration_ms) return false;
                    return true;
                });
            }

            return {
                runs: filteredData,
                total: filteredData.length,
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
    const [searchParams] = useSearchParams();

    // 可见列管理
    const [visibleColumns, setVisibleColumns] = createSignal<Set<string>>(
        new Set(allColumnsConfig.filter(col => col.defaultVisible).map(col => col.id))
    );
    const [showColumnSettings, setShowColumnSettings] = createSignal(false);

    // 过滤条件
    const [filters, setFilters] = createSignal<LlmRunFilters>({
        run_type: (searchParams.run_type as string) || "llm",
        system: (searchParams.system as string) || "",
        model_name: (searchParams.model_name as string) || "",
        thread_id: (searchParams.thread_id as string) || "",
        user_id: (searchParams.user_id as string) || "",
        start_time_after:
            (searchParams.start_time_after as string) ||
            threeDaysAgo().toISOString(),
        start_time_before:
            (searchParams.start_time_before as string) ||
            todayEnd().toISOString(),
        has_error: undefined,
        has_feedback: undefined,
        min_tokens: undefined,
        max_tokens: undefined,
        min_duration_ms: undefined,
        max_duration_ms: undefined,
    });

    // 临时过滤条件（用于输入）
    const [tempFilters, setTempFilters] = createSignal<LlmRunFilters>({
        run_type: (searchParams.run_type as string) || "llm",
        system: (searchParams.system as string) || "",
        model_name: (searchParams.model_name as string) || "",
        thread_id: (searchParams.thread_id as string) || "",
        user_id: (searchParams.user_id as string) || "",
        start_time_after:
            (searchParams.start_time_after as string) ||
            threeDaysAgo().toISOString(),
        start_time_before:
            (searchParams.start_time_before as string) ||
            todayEnd().toISOString(),
        has_error: undefined,
        has_feedback: undefined,
        min_tokens: undefined,
        max_tokens: undefined,
        min_duration_ms: undefined,
        max_duration_ms: undefined,
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
        },
    );

    // 获取当前可见的列配置
    const currentColumns = createMemo(() => {
        return allColumnsConfig.filter(col => visibleColumns().has(col.id));
    });

    const totalRunsCount = createMemo(() => {
        const runsData = llmRunsResource();
        return runsData?.total ?? 0;
    });

    const totalPages = createMemo(() => {
        return Math.ceil(totalRunsCount() / itemsPerPage());
    });

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(1, prev - 1));
        refetchLlmRuns();
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(totalPages(), prev + 1));
        refetchLlmRuns();
    };

    const [selectedRun, setSelectedRun] = createSignal<RunRecord | null>(null);

    const handleRowClick = (run: RunRecord) => {
        setSelectedRun(run);
    };

    // 处理临时过滤条件变化
    const handleTempFilterChange = (
        field: keyof LlmRunFilters,
        value: string | boolean | number | undefined,
    ) => {
        setTempFilters((prev) => ({ ...prev, [field]: value }));
    };

    // 执行搜索
    const handleSearch = () => {
        setFilters(tempFilters());
        setCurrentPage(1);
        refetchLlmRuns();
    };

    // 清除过滤条件
    const handleClearFilters = () => {
        const defaultFilters: LlmRunFilters = {
            run_type: "llm",
            system: "",
            model_name: "",
            thread_id: "",
            user_id: "",
            start_time_after: threeDaysAgo().toISOString(),
            start_time_before: todayEnd().toISOString(),
            has_error: undefined,
            has_feedback: undefined,
            min_tokens: undefined,
            max_tokens: undefined,
            min_duration_ms: undefined,
            max_duration_ms: undefined,
        };
        setTempFilters(defaultFilters);
        setFilters(defaultFilters);
        setCurrentPage(1);
    };

    // 切换列的可见性
    const toggleColumn = (columnId: string) => {
        setVisibleColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(columnId)) {
                newSet.delete(columnId);
            } else {
                newSet.add(columnId);
            }
            return newSet;
        });
    };

    // 显示所有列
    const showAllColumns = () => {
        setVisibleColumns(new Set(allColumnsConfig.map(col => col.id)));
    };

    // 隐藏所有列
    const hideAllColumns = () => {
        setVisibleColumns(new Set());
    };

    // 重置为默认列
    const resetColumns = () => {
        setVisibleColumns(new Set(allColumnsConfig.filter(col => col.defaultVisible).map(col => col.id)));
    };

    return (
        <div class="h-screen bg-gray-50 flex flex-col">
            {/* 固定顶部导航栏 */}
            <header class="bg-white border-b border-gray-200 flex-shrink-0 sticky top-0 z-10">
                <div class="px-4 py-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <h1 class="text-xl font-bold text-gray-900">
                                LLM 运行统计
                            </h1>
                            <div class="h-5 w-px bg-gray-300"></div>
                            <span class="text-sm text-gray-500">
                                增强数据监控面板
                            </span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button
                                onClick={() => setShowColumnSettings(!showColumnSettings())}
                                class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                title="配置显示列"
                            >
                                <Settings2 class="w-4 h-4 mr-1.5" />
                                列设置
                                {showColumnSettings() ? <ChevronUp class="w-4 h-4 ml-1" /> : <ChevronDown class="w-4 h-4 ml-1" />}
                            </button>
                            <button
                                onClick={refetchLlmRuns}
                                class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                                <RefreshCw class="w-4 h-4 mr-1.5" />
                                刷新数据
                            </button>
                        </div>
                    </div>
                </div>

                {/* 列配置面板 */}
                <Show when={showColumnSettings()}>
                    <div class="px-4 py-3 border-t border-gray-200 bg-gray-50">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-medium text-gray-700">
                                显示列配置
                            </span>
                            <div class="flex items-center space-x-2">
                                <button
                                    onClick={resetColumns}
                                    class="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    重置默认
                                </button>
                                <button
                                    onClick={showAllColumns}
                                    class="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    全部显示
                                </button>
                                <button
                                    onClick={hideAllColumns}
                                    class="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    全部隐藏
                                </button>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                            <For each={allColumnsConfig}>
                                {(col) => (
                                    <label class="inline-flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={visibleColumns().has(col.id)}
                                            onChange={() => toggleColumn(col.id)}
                                            class="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
                                        />
                                        <span class="text-xs text-gray-700">{col.header}</span>
                                    </label>
                                )}
                            </For>
                        </div>
                        <div class="mt-2 text-xs text-gray-500">
                            已选择 {visibleColumns().size} / {allColumnsConfig.length} 列
                        </div>
                    </div>
                </Show>

                {/* 固定过滤条件卡片 */}
                <div class="bg-white border-t border-gray-200">
                    <div class="p-3">
                        {/* 基础过滤 */}
                        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">
                                    系统
                                </label>
                                <select
                                    class="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    value={tempFilters().system}
                                    onChange={(e) =>
                                        handleTempFilterChange(
                                            "system",
                                            e.currentTarget.value,
                                        )
                                    }
                                >
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
                                <label class="block text-xs font-medium text-gray-700 mb-1">
                                    模型
                                </label>
                                <select
                                    class="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    value={tempFilters().model_name}
                                    onChange={(e) =>
                                        handleTempFilterChange(
                                            "model_name",
                                            e.currentTarget.value,
                                        )
                                    }
                                >
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
                                <label class="block text-xs font-medium text-gray-700 mb-1">
                                    会话 ID
                                </label>
                                <input
                                    type="text"
                                    class="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    placeholder="会话 ID..."
                                    value={tempFilters().thread_id}
                                    onInput={(e) =>
                                        handleTempFilterChange(
                                            "thread_id",
                                            e.currentTarget.value,
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-700 mb-1">
                                    用户ID
                                </label>
                                <input
                                    type="text"
                                    class="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    placeholder="用户ID..."
                                    value={tempFilters().user_id}
                                    onInput={(e) =>
                                        handleTempFilterChange(
                                            "user_id",
                                            e.currentTarget.value,
                                        )
                                    }
                                />
                            </div>
                            <div style="grid-column: span 2 / span 2;">
                                <label class="block text-xs font-medium text-gray-700 mb-1">
                                    时间范围
                                </label>
                                <DateRangePicker
                                    startTime={tempFilters().start_time_after!}
                                    endTime={tempFilters().start_time_before!}
                                    onStartTimeChange={(value) =>
                                        handleTempFilterChange(
                                            "start_time_after",
                                            value,
                                        )
                                    }
                                    onEndTimeChange={(value) =>
                                        handleTempFilterChange(
                                            "start_time_before",
                                            value,
                                        )
                                    }
                                />
                            </div>
                        </div>

                        {/* 高级过滤 */}
                        <div class="border-t border-gray-200 pt-3">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-medium text-gray-700">
                                    <BarChart3 class="inline-block w-3 h-3 mr-1" />
                                    高级过滤
                                </span>
                            </div>
                            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">
                                        运行状态
                                    </label>
                                    <select
                                        class="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        value={tempFilters().has_error === undefined ? "" : tempFilters().has_error ? "error" : "success"}
                                        onChange={(e) =>
                                            handleTempFilterChange(
                                                "has_error",
                                                e.currentTarget.value === "" ? undefined : e.currentTarget.value === "error",
                                            )
                                        }
                                    >
                                        <option value="">全部</option>
                                        <option value="success">仅成功</option>
                                        <option value="error">仅失败</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">
                                        反馈状态
                                    </label>
                                    <select
                                        class="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        value={tempFilters().has_feedback === undefined ? "" : tempFilters().has_feedback ? "yes" : "no"}
                                        onChange={(e) =>
                                            handleTempFilterChange(
                                                "has_feedback",
                                                e.currentTarget.value === "" ? undefined : e.currentTarget.value === "yes",
                                            )
                                        }
                                    >
                                        <option value="">全部</option>
                                        <option value="yes">有反馈</option>
                                        <option value="no">无反馈</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">
                                        最小 Token
                                    </label>
                                    <input
                                        type="number"
                                        class="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        placeholder="0"
                                        value={tempFilters().min_tokens ?? ""}
                                        onInput={(e) =>
                                            handleTempFilterChange(
                                                "min_tokens",
                                                e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined,
                                            )
                                        }
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">
                                        最大 Token
                                    </label>
                                    <input
                                        type="number"
                                        class="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        placeholder="∞"
                                        value={tempFilters().max_tokens ?? ""}
                                        onInput={(e) =>
                                            handleTempFilterChange(
                                                "max_tokens",
                                                e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined,
                                            )
                                        }
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">
                                        最小时长 (ms)
                                    </label>
                                    <input
                                        type="number"
                                        class="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        placeholder="0"
                                        value={tempFilters().min_duration_ms ?? ""}
                                        onInput={(e) =>
                                            handleTempFilterChange(
                                                "min_duration_ms",
                                                e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined,
                                            )
                                        }
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">
                                        最大时长 (ms)
                                    </label>
                                    <input
                                        type="number"
                                        class="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                        placeholder="∞"
                                        value={tempFilters().max_duration_ms ?? ""}
                                        onInput={(e) =>
                                            handleTempFilterChange(
                                                "max_duration_ms",
                                                e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined,
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div class="mt-3 flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                                <button
                                    onClick={handleSearch}
                                    class="inline-flex items-center px-2.5 py-1 border border-transparent rounded shadow-sm text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 transition-colors"
                                >
                                    <Search class="w-3 h-3 mr-1" />
                                    搜索
                                </button>
                                <button
                                    onClick={handleClearFilters}
                                    class="inline-flex items-center px-2.5 py-1 border border-gray-300 rounded shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 transition-colors"
                                >
                                    <Eraser class="w-3 h-3 mr-1" />
                                    清除
                                </button>
                            </div>
                            <div class="text-xs text-gray-500">
                                结果：
                                <span class="font-medium">
                                    {totalRunsCount()}
                                </span>
                                条记录
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* 主要内容区域 - 可滚动 */}
            <main class="flex-1 flex gap-4 p-4 overflow-hidden">
                {/* 数据表格 */}
                <div class="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
                    {/* 可滚动的表格内容 */}
                    <div class="flex-1 overflow-auto">
                        <Show
                            when={
                                llmRunsResource.loading ||
                                llmRunsResource.error ||
                                !llmRunsResource()?.runs
                            }
                        >
                            <div class="p-8 text-center">
                                <Show
                                    when={llmRunsResource.loading}
                                    fallback={
                                        <Show
                                            when={llmRunsResource.error}
                                            fallback={
                                                <div class="text-center">
                                                    <Info class="mx-auto h-10 w-10 text-gray-400" />
                                                    <h3 class="mt-2 text-sm font-medium text-gray-900">
                                                        暂无数据
                                                    </h3>
                                                    <p class="mt-1 text-xs text-gray-500">
                                                        当前筛选条件下没有找到运行记录
                                                    </p>
                                                </div>
                                            }
                                        >
                                            <div class="text-center">
                                                <X class="mx-auto h-10 w-10 text-red-400" />
                                                <h3 class="mt-2 text-sm font-medium text-gray-900">
                                                    加载错误
                                                </h3>
                                                <p class="mt-1 text-xs text-gray-500">
                                                    {llmRunsResource.error?.message}
                                                </p>
                                            </div>
                                        </Show>
                                    }
                                >
                                    <div class="inline-flex items-center">
                                        <LoaderCircle class="w-4 h-4 mr-2 animate-spin" />
                                        <span class="text-gray-600 text-sm">
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
                                llmRunsResource()?.runs &&
                                currentColumns().length > 0
                            }
                        >
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50 sticky top-0">
                                    <tr>
                                        <For each={currentColumns()}>
                                            {(col: ColumnConfig) => (
                                                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
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
                                                }
                                            >
                                                <For each={currentColumns()}>
                                                    {(col: ColumnConfig) => (
                                                        <td
                                                            class={
                                                                col.className
                                                            }
                                                        >
                                                            {col.format(run)}
                                                        </td>
                                                    )}
                                                </For>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </Show>
                        <Show
                            when={
                                !llmRunsResource.loading &&
                                !llmRunsResource.error &&
                                currentColumns().length === 0
                            }
                        >
                            <div class="p-8 text-center">
                                <Settings2 class="mx-auto h-10 w-10 text-gray-400" />
                                <h3 class="mt-2 text-sm font-medium text-gray-900">
                                    未选择显示列
                                </h3>
                                <p class="mt-1 text-xs text-gray-500">
                                    请点击"列设置"按钮选择要显示的数据列
                                </p>
                            </div>
                        </Show>
                    </div>

                    {/* 固定分页控件 */}
                    <Show when={totalPages() > 0}>
                        <div class="px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0 sticky bottom-0 z-10">
                            <div class="flex items-center justify-between">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={
                                        currentPage() === 1 ||
                                        llmRunsResource.loading
                                    }
                                    class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ArrowLeft class="w-3 h-3 mr-1" />
                                    上一页
                                </button>

                                <div class="flex items-center space-x-2">
                                    <span class="text-xs text-gray-700">
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
                                    <div class="h-3 w-px bg-gray-300"></div>
                                    <span class="text-xs text-gray-500">
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
                                    class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    下一页
                                    <ArrowRight class="w-3 h-3 ml-1" />
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
            </main>
        </div>
    );
};
