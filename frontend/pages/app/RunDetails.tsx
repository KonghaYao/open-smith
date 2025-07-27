import { createMemo, createSignal, type Accessor } from "solid-js";
import { formatDateTime } from "../../utils.js";
import {
    IOTab,
    EventsTab,
    MetadataTab,
    FeedbackTab,
} from "../../components/RunDetails/index.js";
import { parseJSON, getRunType } from "../../utils.jsx";
import type { TraceInfo } from "../../../src/types.js";
interface RunDetailsProps {
    selectedRunId: Accessor<string | null>;
    currentTraceData: Accessor<TraceInfo | null>;
    refresh: () => void;
    refreshTrigger: Accessor<number>;
}
// RunDetails 组件 (右侧面板)
export const RunDetails = (props: RunDetailsProps) => {
    const [activeTab, setActiveTab] = createSignal("io");
    // const { refresh } = useRefresh(); // 移除 Context 使用

    const selectedRunData = createMemo(() => {
        if (!props.selectedRunId() || !props.currentTraceData())
            return undefined;
        return props
            .currentTraceData()
            ?.runs?.find((run) => run.id === props.selectedRunId());
    });

    const selectedRunFeedback = createMemo(() => {
        return selectedRunData()?.feedback || [];
    });

    const selectedRunAttachments = createMemo(() => {
        return selectedRunData()?.attachments || [];
    });

    const extraData = createMemo(() => {
        const run = selectedRunData();
        if (!run || !run.extra) return null;
        return parseJSON(run.extra);
    });

    return (
        <div class="flex-1 border-l border-gray-200 bg-white flex flex-col h-screen">
            {/* 头部 */}
            <div class="p-4 border-b border-gray-200">
                {props.selectedRunId() && selectedRunData() ? (
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <h3 class="text-lg font-semibold text-gray-900">
                                {selectedRunData()?.name ||
                                    props.selectedRunId()}
                            </h3>
                            <button
                                class="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                                onClick={props.refresh}
                                title="刷新数据">
                                <svg
                                    class="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="flex items-center space-x-4 text-sm text-gray-600">
                            <span>ID: {props.selectedRunId()}</span>
                            <span>Type: {getRunType(selectedRunData())}</span>
                            <span class="flex items-center">
                                <div
                                    class={`w-2 h-2 rounded-full ${
                                        selectedRunData()?.error
                                            ? "bg-red-500"
                                            : "bg-green-500"
                                    } mr-1`}></div>
                                {selectedRunData()?.error ? "失败" : "成功"}
                            </span>
                            <span>
                                {formatDateTime(selectedRunData()?.created_at!)}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div class="text-center text-gray-500 py-2">
                        <svg
                            class="w-12 h-12 mx-auto mb-2 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <p>请选择一个 Run 来查看详情</p>
                    </div>
                )}
            </div>

            {/* Tab 导航 */}
            {(() => {
                const selectedClass = (tab: string) => {
                    return `px-4 py-2 text-sm font-medium border-b-2 ${
                        activeTab() === tab
                            ? "text-blue-600 border-blue-600"
                            : "text-gray-600 hover:text-gray-900 border-transparent"
                    }`;
                };
                return props.selectedRunId() && selectedRunData() ? (
                    <div class="flex border-b border-gray-200 bg-gray-50">
                        <button
                            class={selectedClass("io")}
                            onClick={() => setActiveTab("io")}>
                            输入/输出
                        </button>
                        <button
                            class={selectedClass("events")}
                            onClick={() => setActiveTab("events")}>
                            事件时间线
                        </button>
                        <button
                            class={selectedClass("metadata")}
                            onClick={() => setActiveTab("metadata")}>
                            元数据
                        </button>
                        <button
                            class={selectedClass("feedback")}
                            onClick={() => setActiveTab("feedback")}>
                            反馈 ({selectedRunFeedback().length})
                        </button>
                    </div>
                ) : (
                    ""
                );
            })()}

            {/* Tab 内容 */}
            <div class="flex-1 overflow-auto scrollbar">
                {selectedRunData() ? (
                    <>
                        {activeTab() === "io" ? (
                            <IOTab run={selectedRunData()!} />
                        ) : null}
                        {activeTab() === "events" ? (
                            <EventsTab run={selectedRunData()} />
                        ) : null}
                        {activeTab() === "metadata" ? (
                            <MetadataTab extraData={extraData()} />
                        ) : null}
                        {activeTab() === "feedback" ? (
                            <FeedbackTab run={selectedRunData()!} />
                        ) : null}
                    </>
                ) : null}
            </div>
        </div>
    );
};
