import html from "solid-js/html";
import { createLucideIcon } from "../../icons.js";

const commonClass =
    "w-6 h-6 rounded-lg flex items-center justify-center text-white p-1";

const Graph = () =>
    html`<div class=${() => commonClass + " bg-indigo-500 "}>
        ${createLucideIcon("waypoints", true)}
    </div>`;
const LLM = () =>
    html`<div class=${() => commonClass + " bg-yellow-500 "}>
        ${createLucideIcon("orbit", true)}
    </div>`;
const Tool = () =>
    html`<div class=${() => commonClass + " bg-emerald-500 "}>
        ${createLucideIcon("wrench", true)}
    </div>`;
const Prompt = () =>
    html`<div class=${() => commonClass + " bg-sky-400 "}>
        ${createLucideIcon("message-square", true)}
    </div>`;
const InnerNode = () =>
    html`<div class=${() => commonClass + " bg-sky-400 "}>
        ${createLucideIcon("link", true)}
    </div>`;
export const icon = {
    CompiledStateGraph: Graph,
    RunnableSequence: InnerNode,
    ChannelWrite: InnerNode,
    ChatOpenAI: LLM,
    RunnableLambda: InnerNode,
    RunnableCallable: InnerNode,
    LangGraph: Graph,
    Prompt: Prompt,
    DynamicStructuredTool: Tool,
    unknown: InnerNode,
};
// 格式化执行时间
export const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return "N/A";
    const duration = parseInt(endTime) - parseInt(startTime);
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`;
    return `${(duration / 60000).toFixed(2)}m`;
};

// 解析 JSON 字符串
export const parseJSON = (jsonString) => {
    try {
        return JSON.parse(jsonString);
    } catch {
        return null;
    }
};

// 格式化时间戳
export const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp * 1);
    return date.toLocaleString();
};

const specialName = Object.keys(icon);
export const getRunType = (run) => {
    if (specialName.includes(run.name)) {
        return run.name;
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

export const getMetaDataOfRun = (run) => {
    if (run.extra) {
        try {
            const extra = JSON.parse(run.extra);
            return extra.metadata;
        } catch {
            return null;
        }
    }
};
