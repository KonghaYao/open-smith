import { createSignal, For, Show, createMemo, createResource } from "solid-js";
import { Settings, Plus, X } from "lucide-solid";
import { ModelConfigModal } from "../../components/ModelConfigModal.jsx";
import { createStoreSignal } from "../../utils.jsx";
import { GraphStateMessage } from "../../components/Graph/GraphState.jsx";
import { MessageEditor } from "../../components/MessageEditor.jsx";
import {
    createTemplate,
    extractAllVariables,
    replaceVariables,
} from "../../types.js";
import { ofetch } from "../../api.js";

// 定义消息模板类型
interface MessageTemplate {
    type: string;
    content: string;
}

// 定义模型配置类型
interface ModelConfig {
    id: string;
    name: string;
    provider: string;
    model_name: string;
    api_key?: string;
    // 其他可能的配置属性
}

// 定义请求负载类型
interface RequestPayload {
    messages: MessageTemplate[];
    inputs: Record<string, string>;
    model: ModelConfig;
    tools: any[]; // 暂时设为 any[]，如果需要可以细化
    output_schema?: any; // 暂时设为 any，如果需要可以细化
    type: "stream" | "invoke";
}

// 默认消息 - 使用新的 Template 格式
const [defaultMessage, setDefaultMessage] = createSignal<MessageTemplate[]>([
    createTemplate("system", "You are a chatbot."),
    createTemplate("human", "{{question}}"),
]);
export { setDefaultMessage };

export const PlayGround = () => {
    // 状态管理
    const [messages, setMessages] = createSignal<MessageTemplate[]>(
        defaultMessage()
    );
    const [inputs, setInputs] = createSignal<Record<string, string>>({});

    const [modelConfigs] = createStoreSignal<ModelConfig[]>("modelConfigs", []);
    const [selectedModelId, setSelectedModelId] = createStoreSignal<
        string | null
    >("selectedModelId", null);
    const selectedConfig = createMemo(() => {
        return modelConfigs().find(
            (c: ModelConfig) => c.id === selectedModelId()
        );
    });

    const [showModelModal, setShowModelModal] = createSignal<boolean>(false);

    const [outputSchemaText, setOutputSchemaText] = createSignal<string>("");
    const [toolsText, setToolsText] = createSignal<string>("[]");

    // Tab 状态管理
    const [activeTab, setActiveTab] = createSignal<"schema" | "tools" | null>(
        null
    ); // null, 'schema', 'tools'

    // Request payload for createResource
    const [requestPayload, setRequestPayload] =
        createSignal<RequestPayload | null>(null);

    // Stream content for streaming responses
    const [streamContent, setStreamContent] = createSignal<any[]>([]); // 暂时设为 any[]，如果需要可以细化
    const composedStreamContent = createMemo(() => {
        let content = "";
        for (const i of streamContent()) {
            content += i.kwargs.content;
        }
        return [
            {
                type: "constructor",
                lc: 1,
                id: ["langchain_core", "messages", "AIMessage"],
                kwargs: {
                    content: content,
                },
            },
        ];
    });
    // 创建资源
    const [response, { refetch }] = createResource(
        requestPayload,
        async (payload) => {
            if (!payload) return null;

            // 替换消息中的变量
            const processedMessages = payload.messages.map((template) => ({
                ...template,
                content: replaceVariables(template.content, payload.inputs),
            }));

            const apiPayload = {
                ...payload,
                messages: processedMessages,
            };

            if (payload.type === "stream") {
                // 流式处理
                setStreamContent([]);
                const response = await ofetch("/llm/stream", {
                    method: "POST",
                    body: apiPayload,
                    responseType: "stream",
                });

                const chunks: any[] = [];
                const writableStream = new WritableStream({
                    write(chunk) {
                        const lines = chunk.split("\n");
                        for (const line of lines) {
                            if (line.trim() && line.startsWith("data: ")) {
                                if (line.trim() === "data: [DONE]") {
                                    continue;
                                }
                                try {
                                    const data = JSON.parse(
                                        line.slice(6).trim()
                                    );
                                    chunks.push(data);
                                    setStreamContent([...chunks]);
                                } catch (e) {
                                    console.error("Error parsing JSON:", e);
                                }
                            }
                        }
                    },
                    close() {
                        console.log("Stream finished.");
                    },
                    abort(err) {
                        console.error("Stream aborted:", err);
                    },
                });

                try {
                    await response
                        .pipeThrough(new TextDecoderStream())
                        .pipeTo(writableStream);
                } catch (error) {
                    console.error("Error piping the stream:", error);
                }
                return { type: "stream", chunks };
            } else {
                // 普通调用
                const response = await ofetch("/llm/invoke", {
                    method: "POST",
                    body: apiPayload,
                });

                return { type: "invoke", data: response };
            }
        }
    );

    const variables = createMemo(() => {
        return extractAllVariables(messages());
    });

    // 更新输入变量的值
    const handleInputChange = (name: string, value: string) => {
        setInputs((prev) => ({ ...prev, [name]: value }));
    };

    // 添加消息
    const addMessage = () => {
        setMessages((prev) => [...prev, createTemplate("user", "")]);
    };

    // 删除消息
    const removeMessage = (index: number) => {
        setMessages((prev) => prev.filter((_, i) => i !== index));
    };

    // 更新消息
    const updateMessage = (index: number, newTemplate: MessageTemplate) => {
        setMessages((prev) =>
            prev.map((template, i) => (i === index ? newTemplate : template))
        );
    };

    const commitTestRun = (type: "stream" | "invoke") => {
        if (!selectedConfig()) {
            alert("请先选择一个模型配置！");
            setShowModelModal(true);
            return;
        }
        setRequestPayload({
            messages: messages(),
            inputs: inputs(),
            model: selectedConfig()!,
            tools:
                activeTab() === "tools" ? JSON.parse(toolsText() || "[]") : [],
            output_schema: outputSchemaText()
                ? JSON.parse(outputSchemaText())
                : undefined,
            type: type,
        });
        refetch();
    };

    return (
        <div class="h-screen flex flex-col bg-gray-50 font-sans text-gray-800">
            {/* Top Bar */}
            <header class="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
                <div>
                    <p class="text-sm text-gray-500">Personal / Playground</p>
                    <h1 class="text-xl font-semibold text-gray-900 mt-1">
                        Playground
                    </h1>
                </div>
                <div class="flex items-center space-x-2">
                    <div class="flex rounded-md border border-gray-300">
                        <button
                            onClick={() => {
                                commitTestRun("invoke");
                            }}
                            disabled={response.loading}
                            class="px-5 py-2 bg-green-600 text-white rounded-l-lg flex items-center font-medium shadow-sm transition-colors duration-150 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed border-r border-green-700">
                            运行
                        </button>
                        <button
                            onClick={() => {
                                commitTestRun("stream");
                            }}
                            disabled={response.loading}
                            class="px-3 py-2 bg-green-600 text-white rounded-r-lg flex items-center font-medium shadow-sm transition-colors duration-150 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            title="流式运行">
                            流式
                        </button>
                    </div>
                </div>
            </header>

            <main class="flex-1 grid grid-cols-12 gap-6 p-6 overflow-y-auto">
                {/* Left and Middle Panel */}
                <div class="col-span-8 flex flex-col gap-4 min-h-0">
                    <div class="flex items-center justify-between">
                        <h2 class="text-base font-semibold flex items-center">
                            Prompts
                        </h2>
                        <div class="flex items-center gap-2">
                            <div class="flex items-center border border-gray-300 rounded-md bg-white">
                                <span class="px-3 py-1.5 text-sm">
                                    {selectedConfig()?.name || "Select Model"}
                                </span>
                                <button
                                    onClick={() => setShowModelModal(true)}
                                    class="p-2 border-l border-gray-300 hover:bg-gray-100"
                                    title="Manage Models">
                                    <Settings />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Messages Section */}
                    <div class="flex-1 flex flex-col min-h-0">
                        <div class="flex-1 overflow-y-auto space-y-3 pr-2">
                            <MessageEditor
                                messages={messages}
                                onUpdateMessage={updateMessage}
                                onRemoveMessage={removeMessage}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                            <button
                                onClick={addMessage}
                                class="px-3 py-1 text-sm border border-gray-300 rounded-md flex items-center bg-white hover:bg-gray-100">
                                <Plus /> Message
                            </button>
                            <button
                                onClick={() =>
                                    setActiveTab(
                                        activeTab() === "schema"
                                            ? null
                                            : "schema"
                                    )
                                }
                                class={
                                    "px-3 py-1 text-sm border rounded-md flex items-center hover:bg-gray-100" +
                                    (activeTab() === "schema"
                                        ? "bg-blue-100 border-blue-300"
                                        : "bg-white border-gray-300")
                                }>
                                <Plus /> Output Schema
                            </button>
                            <button
                                onClick={() =>
                                    setActiveTab(
                                        activeTab() === "tools" ? null : "tools"
                                    )
                                }
                                class={
                                    "px-3 py-1 text-sm border rounded-md flex items-center hover:bg-gray-100" +
                                    (activeTab() === "tools"
                                        ? "bg-blue-100 border-blue-300"
                                        : "bg-white border-gray-300")
                                }>
                                <Plus /> Tool
                            </button>
                        </div>
                    </div>

                    {/* Tab Content Area */}
                    <Show when={activeTab()}>
                        {
                            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                {/* Tab Headers */}
                                <div class="flex border-b border-gray-200">
                                    <button
                                        onClick={() => setActiveTab("schema")}
                                        class={
                                            "px-4 py-2 text-sm font-medium" +
                                            (activeTab() === "schema"
                                                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-500"
                                                : "text-gray-500 hover:text-gray-700")
                                        }>
                                        Output Schema
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("tools")}
                                        class={
                                            "px-4 py-2 text-sm font-medium" +
                                            (activeTab() === "tools"
                                                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-500"
                                                : "text-gray-500 hover:text-gray-700")
                                        }>
                                        Tools
                                    </button>
                                    <div class="flex-1"></div>
                                    <button
                                        onClick={() => setActiveTab(null)}
                                        class="px-3 py-2 text-gray-400 hover:text-gray-600"
                                        title="关闭">
                                        <X />
                                    </button>
                                </div>

                                {/* Tab Content */}
                                <div class="p-4 max-h-60 overflow-y-auto">
                                    <Show when={activeTab() === "schema"}>
                                        <div>
                                            <h3 class="text-sm font-semibold mb-2">
                                                Output Schema (JSON)
                                            </h3>
                                            <textarea
                                                value={outputSchemaText()}
                                                onChange={(e) =>
                                                    setOutputSchemaText(
                                                        e.currentTarget.value
                                                    )
                                                }
                                                placeholder=""
                                                class="w-full p-2 border border-gray-300 rounded-md font-mono text-sm resize-none"
                                                rows={8}></textarea>
                                        </div>
                                    </Show>
                                    <Show when={activeTab() === "tools"}>
                                        <div>
                                            <h3 class="text-sm font-semibold mb-2">
                                                Tools (JSON)
                                            </h3>
                                            <textarea
                                                value={toolsText()}
                                                onInput={(e) =>
                                                    setToolsText(
                                                        e.currentTarget.value
                                                    )
                                                }
                                                placeholder=""
                                                class="w-full p-2 border border-gray-300 rounded-md font-mono text-sm resize-none"
                                                rows={8}></textarea>
                                        </div>
                                    </Show>
                                </div>
                            </div>
                        }
                    </Show>
                </div>

                {/* Right Panel: Inputs & Output */}
                <div class="col-span-4 flex flex-col gap-6 h-full overflow-hidden">
                    {/* Inputs */}
                    <div class="bg-white border border-gray-200 rounded-lg p-4">
                        <h2 class="text-base font-semibold flex items-center mb-3">
                            Inputs
                        </h2>
                        <div class="space-y-3">
                            <For each={variables()}>
                                {(variable) => (
                                    <div>
                                        <label class="text-sm font-medium text-gray-700">
                                            {variable}
                                        </label>
                                        <input
                                            type="text"
                                            value={inputs()[variable] || ""}
                                            onChange={(e) =>
                                                handleInputChange(
                                                    variable,
                                                    e.currentTarget.value
                                                )
                                            }
                                            class="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400"
                                            placeholder="Enter variable value..."
                                        />
                                    </div>
                                )}
                            </For>
                            <Show when={variables().length === 0}>
                                <p class="text-sm text-gray-500">
                                    No variables found in prompts.
                                </p>
                            </Show>
                        </div>
                    </div>

                    {/* Output */}
                    <div class="bg-white border border-gray-200 rounded-lg p-4 flex-1 flex flex-col overflow-auto">
                        <h2 class="text-base font-semibold flex items-center mb-3">
                            Output
                        </h2>
                        <div class="flex-1 overflow-auto bg-gray-50 rounded-md p-3 text-sm">
                            <Show when={response.loading}>
                                <p class="text-gray-500">Generating...</p>
                            </Show>
                            <Show when={response.error}>
                                {(error) => (
                                    <p class="text-red-500">
                                        Error:{" "}
                                        {(error() as Error)?.message ||
                                            String(error())}
                                    </p>
                                )}
                            </Show>
                            <Show
                                when={
                                    !response.loading &&
                                    response()?.type === "stream"
                                }>
                                <GraphStateMessage
                                    state={{
                                        messages: composedStreamContent(),
                                    }}
                                    reverse={() => false}
                                />
                            </Show>
                            <Show
                                when={
                                    !response.loading &&
                                    response()?.type === "invoke"
                                }>
                                <GraphStateMessage
                                    state={{
                                        messages: [response()!.data],
                                    }}
                                    reverse={() => false}
                                />
                            </Show>
                            <Show
                                when={
                                    !response.loading &&
                                    !response() &&
                                    !streamContent()?.length
                                }>
                                <p class="text-gray-500">
                                    Click Start to run generation...
                                </p>
                            </Show>
                        </div>
                    </div>
                </div>
            </main>

            {/* Model Config Modal */}
            <ModelConfigModal
                isOpen={showModelModal()}
                onClose={() => setShowModelModal(false)}
            />
        </div>
    );
};
