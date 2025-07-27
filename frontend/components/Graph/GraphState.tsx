import { createMemo, createEffect, createResource } from "solid-js";
import { load } from "@langchain/core/load";
import {
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
} from "@langchain/core/messages";

type LangChainMessage = AIMessage | HumanMessage | SystemMessage | ToolMessage;

export const GraphStatePanel = (props: { state: any }) => {
    const state = createMemo(() => {
        const data = { ...props.state };
        delete data.messages;
        return data;
    });
    return <JSONViewer data={state()} />;
};

export const GraphStateMessage = (props: {
    state: any;
    reverse: () => boolean;
    toPlayground?: (props: { messages: any[] }) => any;
}) => {
    const [LCMessage, { refetch }] = createResource<LangChainMessage[]>(
        async () => {
            try {
                if (!props.state?.messages?.length) {
                    return [];
                }
                const messages = [...props.state.messages].flat();
                const LangChainMessages = await Promise.all(
                    messages.map((i) => {
                        if (i.lc !== 1) {
                            switch (i.type) {
                                case "ai":
                                    return new AIMessage(i);
                                case "human":
                                    return new HumanMessage(i);
                                case "system":
                                    return new SystemMessage(i);
                                case "tool":
                                    return new ToolMessage(i);
                            }
                        }

                        if (i.id[0] === "langchain") {
                            i.id = [
                                "langchain_core",
                                "messages",
                                i.id[i.id.length - 1],
                            ];
                        }
                        return load(JSON.stringify(i), {
                            importMap: {
                                schema: {
                                    messages: {
                                        AIMessage,
                                        HumanMessage,
                                        SystemMessage,
                                        ToolMessage,
                                    },
                                },
                            },
                        }) as any as LangChainMessage;
                    })
                );
                return LangChainMessages;
            } catch (error) {
                console.error(error);
                return [];
            }
        },
        {
            initialValue: [],
        }
    );
    createEffect(() => {
        if (props.state.messages?.length) {
            refetch();
        }
    });
    const message = createMemo(() => {
        if (props.reverse()) {
            return [...LCMessage()].reverse() as LangChainMessage[];
        }
        return LCMessage() as LangChainMessage[];
    });
    return (
        <div class="space-y-4 p-4">
            {props?.toPlayground?.({ messages: message() })}
            {LCMessage.loading ? (
                <div class="flex items-center justify-center p-8 text-gray-500">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
                    加载中...
                </div>
            ) : (
                message().map((i: LangChainMessage) => {
                    if (!i._getType) {
                        console.warn("Unknown message type", i);
                        return (
                            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div class="text-red-600 font-medium mb-2">
                                    未知消息类型
                                </div>
                                <pre class="text-sm text-red-700 whitespace-pre-wrap">
                                    {JSON.stringify(i, null, 2)}
                                </pre>
                            </div>
                        );
                    }
                    if (i["_getType"]() === "ai") {
                        return (
                            <div class="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                                <div class="bg-blue-100 px-4 py-2 border-b border-blue-200">
                                    <span class="text-blue-700 font-medium text-sm">
                                        🤖 AI 助手
                                    </span>
                                </div>
                                <div class="p-4 space-y-3">
                                    {i.content && (
                                        <div class="text-gray-800">
                                            <ContentViewer
                                                content={i.content}
                                            />
                                        </div>
                                    )}
                                    {i["_getType"]() === "ai" &&
                                        (i as AIMessage).tool_calls &&
                                        (i as AIMessage).tool_calls!.map(
                                            (toolCall: any) => {
                                                return (
                                                    <div class="bg-white border border-gray-200 rounded-md p-3">
                                                        <div class="text-sm font-medium text-gray-600 mb-2">
                                                            🔧 工具调用:{" "}
                                                            {toolCall.name}
                                                        </div>
                                                        <JSONViewer
                                                            data={toolCall.args}
                                                        />
                                                    </div>
                                                );
                                            }
                                        )}
                                </div>
                            </div>
                        );
                    } else if (
                        i["_getType"]() === "human" ||
                        i["_getType"]() === "system"
                    ) {
                        const isSystem = i["_getType"]() === "system";
                        const PanelClass = isSystem
                            ? "bg-yellow-50 border-yellow-200 overflow-auto max-h-128"
                            : "bg-green-50 border-green-200";
                        const SubPanelClass = isSystem
                            ? "bg-yellow-100 border-yellow-200 px-4 py-2 border-b"
                            : "bg-green-100 border-green-200 px-4 py-2 border-b";
                        const TextClass = isSystem
                            ? "text-yellow-700 font-medium text-sm"
                            : "text-green-700 font-medium text-sm";
                        return (
                            <div class={PanelClass}>
                                <div class={SubPanelClass}>
                                    <span class={TextClass}>
                                        {isSystem ? "⚙️ 系统" : "👤 用户"}
                                    </span>
                                </div>
                                <div class="p-4 text-gray-800">
                                    <ContentViewer content={i.content} />
                                </div>
                            </div>
                        );
                    } else if (i["_getType"]() === "tool") {
                        return (
                            <div class="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
                                <div class="bg-purple-100 px-4 py-2 border-b border-purple-200">
                                    <span class="text-purple-700 font-medium text-sm">
                                        🔧 工具结果
                                    </span>
                                </div>
                                <div class="p-4 text-gray-800">
                                    <ContentViewer content={i.content} />
                                </div>
                            </div>
                        );
                    } else {
                        return (
                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div class="text-gray-600 font-medium mb-2">
                                    其他消息类型
                                </div>
                                <pre class="text-sm text-gray-700 whitespace-pre-wrap">
                                    {JSON.stringify(i, null, 2)}
                                </pre>
                            </div>
                        );
                    }
                })
            )}
        </div>
    );
};

const ContentViewer = (props: { content: any }) => {
    // console.log(props.content);
    if (typeof props.content === "string") {
        return (
            <div class="whitespace-pre-wrap break-words">{props.content}</div>
        );
    } else if (Array.isArray(props.content)) {
        return (
            <div class="space-y-2">
                {props.content.map((i) => (
                    <ContentViewer content={i} />
                ))}
            </div>
        );
    } else if (typeof props.content === "object") {
        if (props.content.type === "text") {
            return (
                <div class="whitespace-pre-wrap break-words">
                    {props.content.text}
                </div>
            );
        } else if (props.content.type === "image_url") {
            const imageUrl = props.content.image_url.url;
            if (imageUrl.startsWith("data:image")) {
                // 如果是base64编码的图片，直接显示
                return (
                    <div class="bg-gray-100 border border-gray-300 rounded-md p-3 text-center">
                        <div class="text-sm text-gray-600 mb-2">📷 图片:</div>
                        <img
                            src={imageUrl}
                            class="max-w-full h-auto"
                            alt="Embedded Image"
                        />
                    </div>
                );
            } else {
                // 否则，显示链接
                return (
                    <div class="bg-gray-100 border border-gray-300 rounded-md p-3">
                        <div class="text-sm text-gray-600 mb-2">
                            📷 图片链接:
                        </div>
                        <a
                            href={imageUrl}
                            target="_blank"
                            class="text-blue-600 hover:text-blue-800 underline text-sm break-all">
                            {imageUrl}
                        </a>
                    </div>
                );
            }
        } else {
            return (
                <div class="bg-gray-100 border border-gray-300 rounded-md p-3">
                    <div class="text-sm text-gray-600 mb-2">📄 对象数据:</div>
                    <pre class="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(props.content, null, 2)}
                    </pre>
                </div>
            );
        }
    } else {
        return <div class="text-gray-700">{props.content}</div>;
    }
};

export const JSONViewer = (props: { data: any }) => {
    return (
        <div
            innerHTML={`<andypf-json-viewer
            indent="4"
            expanded="4"
            theme="default-light"
            show-data-types="false"
            show-toolbar="false"
            expand-icon-type="circle"
            show-copy="true"
            show-size="true"
            data=${JSON.stringify(props.data)}></andypf-json-viewer>`}></div>
    );
};
