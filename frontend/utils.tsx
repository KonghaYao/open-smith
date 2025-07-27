import { createMemo, createSignal } from "solid-js";
import type { RunRecord } from "../src/types.js";
import { Waypoints, Orbit, Wrench, MessageSquare, Link } from "lucide-solid";
// 格式化日期时间
export const formatDateTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

// 格式化文件大小
export const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// JSON 语法高亮
export const highlightJSON = (obj: any) => {
    if (typeof obj === "string") {
        try {
            obj = JSON.parse(obj);
        } catch (e) {
            return obj;
        }
    }

    let json = JSON.stringify(obj, null, 2);
    return <pre>{json}</pre>;
};

export interface UserStoreType {
    selectedSystem: string;
    outputReverse: boolean;
    inputReverse: boolean;
    selectedModelId?: string;
    modelConfigs: any[];
    errors: Record<string, string>;
}

const [userStore, _setUserStore] = createSignal<UserStoreType>(
    JSON.parse(localStorage.getItem("userStore") || JSON.stringify({}))
);

const setUserStore = (data: UserStoreType) => {
    localStorage.setItem("userStore", JSON.stringify(data));
    _setUserStore(data);
};

const patchUserStore = (data: Partial<UserStoreType>) => {
    const store = userStore();
    setUserStore({ ...store, ...data });
};

export const createStoreSignal = <T extends keyof UserStoreType>(
    key: T,
    defaultValue: UserStoreType[T]
) => {
    const value = createMemo(() => userStore()[key] || defaultValue);
    return [
        value,
        (v: UserStoreType[T]) => patchUserStore({ [key]: v }),
    ] as const;
};

const commonClass =
    "w-6 h-6 rounded-lg flex items-center justify-center text-white p-1";

const Graph = () => (
    <div class={commonClass + " bg-indigo-500"}>
        <Waypoints />
    </div>
);
const LLM = () => (
    <div class={commonClass + " bg-yellow-500"}>
        <Orbit />
    </div>
);
const Tool = () => (
    <div class={commonClass + " bg-emerald-500"}>
        <Wrench />
    </div>
);
const Prompt = () => (
    <div class={commonClass + " bg-sky-400"}>
        <MessageSquare />
    </div>
);
const InnerNode = () => (
    <div class={commonClass + " bg-sky-400"}>
        <Link />
    </div>
);

export const icon = {
    CompiledStateGraph: Graph,
    RunnableSequence: InnerNode,
    ChannelWrite: InnerNode,
    ChatOpenAI: LLM,
    RunnableLambda: InnerNode,
    RunnableCallable: InnerNode,
    LangGraph: Graph,
    Prompt,
    DynamicStructuredTool: Tool,
    unknown: InnerNode,
};
// 格式化执行时间
export const formatDuration = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return "N/A";
    const duration = parseInt(endTime) - parseInt(startTime);
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`;
    return `${(duration / 60000).toFixed(2)}m`;
};

// 解析 JSON 字符串
export const parseJSON = (jsonString: string) => {
    try {
        return JSON.parse(jsonString);
    } catch {
        return null;
    }
};

// 格式化时间戳
export const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "N/A";
    const date = new Date(parseInt(timestamp));
    return date.toLocaleString();
};

const specialName = Object.keys(icon);
export const getRunType = (run?: RunRecord): keyof typeof icon => {
    if (!run) return "unknown";
    if (specialName.includes(run.name!)) {
        return run.name as keyof typeof icon;
    }
    if (run.serialized) {
        try {
            const serialized = JSON.parse(run.serialized);
            if (serialized.id) {
                return serialized.id[serialized.id.length - 1];
            }
        } catch {
            return "unknown";
        }
    }
    return "unknown";
};

export const getMetaDataOfRun = (run: RunRecord) => {
    if (run.extra) {
        try {
            const extra = JSON.parse(run.extra);
            return extra.metadata;
        } catch {
            return null;
        }
    }
};
