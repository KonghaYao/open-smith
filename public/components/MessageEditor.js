import { createSignal } from "solid-js";
import html from "solid-js/html";
import { createLucideIcon } from "../icons.js";

const messageTypes = ["system", "human", "ai", "tool"];
const contentTypes = ["text", "image_url"];

// 检查 content 是否为数组格式
const isContentArray = (content) => {
    return Array.isArray(content);
};

// 创建新的内容项
const createContentItem = (type = "text", value = "") => {
    if (type === "text") {
        return { type: "text", text: value };
    } else if (type === "image_url") {
        return { type: "image_url", image_url: { url: value } };
    }
    return { type: "text", text: "" };
};

// 将字符串内容转换为数组格式
const stringToContentArray = (content) => {
    if (typeof content === "string") {
        return [createContentItem("text", content)];
    }
    return content;
};

// 将数组内容转换为字符串格式（如果只有一个文本项）
const contentArrayToString = (content) => {
    if (
        Array.isArray(content) &&
        content.length === 1 &&
        content[0].type === "text"
    ) {
        return content[0].text;
    }
    return content;
};

export const MessageEditor = (props) => {
    return html`
        <div class="space-y-3">
            ${() =>
                props.messages().map(
                    (message, index) => html`
                        <div
                            class="bg-white border border-gray-200 rounded-lg p-3"
                        >
                            <div class="flex justify-between items-center mb-2">
                                <select
                                    value=${message.role}
                                    onchange=${(e) =>
                                        props.onUpdateMessage(index, {
                                            ...message,
                                            role: e.target.value,
                                        })}
                                    class="font-semibold text-xs uppercase bg-transparent focus:outline-none"
                                >
                                    ${messageTypes.map(
                                        (type) => html`<option
                                            value=${type}
                                            selected=${message.role === type}
                                        >
                                            ${type}
                                        </option>`,
                                    )}
                                </select>
                                <div class="flex items-center space-x-2">
                                    <button
                                        onclick=${() => {
                                            const newContent = isContentArray(
                                                message.content,
                                            )
                                                ? contentArrayToString(
                                                      message.content,
                                                  )
                                                : stringToContentArray(
                                                      message.content,
                                                  );
                                            props.onUpdateMessage(index, {
                                                ...message,
                                                content: newContent,
                                            });
                                        }}
                                        class="p-1 text-gray-400 hover:text-blue-500"
                                        title=${isContentArray(message.content)
                                            ? "切换到文本模式"
                                            : "切换到数组模式"}
                                    >
                                        ${createLucideIcon(
                                            isContentArray(message.content)
                                                ? "type"
                                                : "list",
                                        )}
                                    </button>
                                    <button
                                        onclick=${() =>
                                            props.onRemoveMessage(index)}
                                        class="p-1 text-gray-400 hover:text-red-500"
                                    >
                                        ${createLucideIcon("trash-2")}
                                    </button>
                                </div>
                            </div>

                            ${MessageContentEditor({
                                message: message,
                                onUpdateMessage: props.onUpdateMessage,
                                index: index,
                                isContentArray: isContentArray,
                                createContentItem: createContentItem,
                                contentTypes: contentTypes,
                            })}
                            ${ToolCallIdEditor({
                                message: message,
                                onUpdateMessage: props.onUpdateMessage,
                                index: index,
                            })}
                        </div>
                    `,
                )}
        </div>
    `;
};

// MessageContentEditor 组件
const MessageContentEditor = (props) => {
    return html`
        ${() =>
            !isContentArray(props.message.content) &&
            html`
                <textarea
                    value=${props.message.content || ""}
                    onchange=${(e) =>
                        props.onUpdateMessage(props.index, {
                            ...props.message,
                            content: e.target.value,
                        })}
                    placeholder="Enter a message content... Use {{variable}} for variables"
                    class="w-full p-2 border border-gray-300 rounded-md resize-y focus:ring-2 focus:ring-blue-400"
                    rows="3"
                ></textarea>
            `}
        ${() =>
            isContentArray(props.message.content) &&
            html`
                <div class="space-y-2">
                    ${props.message.content.map(
                        (item, itemIndex) => html`
                            <div
                                class="flex items-start space-x-2 p-2 border border-gray-200 rounded"
                            >
                                <select
                                    value=${item.type}
                                    onchange=${(e) => {
                                        const newContent = [
                                            ...props.message.content,
                                        ];
                                        const oldValue =
                                            item.type === "text"
                                                ? item.text
                                                : item.image_url?.url || "";
                                        newContent[itemIndex] =
                                            props.createContentItem(
                                                e.target.value,
                                                oldValue,
                                            );
                                        props.onUpdateMessage(props.index, {
                                            ...props.message,
                                            content: newContent,
                                        });
                                    }}
                                    class="text-sm border border-gray-300 rounded p-1"
                                >
                                    ${props.contentTypes.map(
                                        (type) => html`<option
                                            value=${type}
                                            selected=${item.type === type}
                                        >
                                            ${type}
                                        </option>`,
                                    )}
                                </select>
                                <div class="flex-1">
                                    ${item.type === "text" &&
                                    html`
                                        <textarea
                                            value=${item.text || ""}
                                            onchange=${(e) => {
                                                const newContent = [
                                                    ...props.message.content,
                                                ];
                                                newContent[itemIndex] = {
                                                    ...item,
                                                    text: e.target.value,
                                                };
                                                props.onUpdateMessage(
                                                    props.index,
                                                    {
                                                        ...props.message,
                                                        content: newContent,
                                                    },
                                                );
                                            }}
                                            placeholder="Enter text content..."
                                            class="w-full p-2 border border-gray-300 rounded-md resize-y focus:ring-2 focus:ring-blue-400"
                                            rows="2"
                                        ></textarea>
                                    `}
                                    ${item.type === "image_url" &&
                                    html`
                                        <input
                                            type="text"
                                            value=${item.image_url?.url || ""}
                                            onchange=${(e) => {
                                                const newContent = [
                                                    ...props.message.content,
                                                ];
                                                newContent[itemIndex] = {
                                                    ...item,
                                                    image_url: {
                                                        url: e.target.value,
                                                    },
                                                };
                                                props.onUpdateMessage(
                                                    props.index,
                                                    {
                                                        ...props.message,
                                                        content: newContent,
                                                    },
                                                );
                                            }}
                                            placeholder="Enter image URL..."
                                            class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400"
                                        />
                                    `}
                                </div>
                                <button
                                    onclick=${() => {
                                        const newContent =
                                            props.message.content.filter(
                                                (_, i) => i !== itemIndex,
                                            );
                                        props.onUpdateMessage(props.index, {
                                            ...props.message,
                                            content:
                                                newContent.length > 0
                                                    ? newContent
                                                    : "",
                                        });
                                    }}
                                    class="p-1 text-gray-400 hover:text-red-500"
                                    title="删除内容项"
                                >
                                    ${createLucideIcon("x")}
                                </button>
                            </div>
                        `,
                    )}
                    <button
                        onclick=${() => {
                            const newContent = Array.isArray(
                                props.message.content,
                            )
                                ? [...props.message.content]
                                : [];
                            newContent.push(
                                props.createContentItem("text", ""),
                            );
                            props.onUpdateMessage(props.index, {
                                ...props.message,
                                content: newContent,
                            });
                        }}
                        class="w-full p-2 border border-dashed border-gray-300 rounded-md text-gray-500 hover:text-gray-700 hover:border-gray-400"
                    >
                        + 添加内容项
                    </button>
                </div>
            `}
    `;
};

// ToolCallIdEditor 组件
const ToolCallIdEditor = (props) => {
    return (
        props.message.role === "tool" &&
        html`
            <div class="mt-2 space-y-2">
                <input
                    type="text"
                    value=${props.message.tool_call_id || ""}
                    onchange=${(e) =>
                        props.onUpdateMessage(props.index, {
                            ...props.message,
                            tool_call_id: e.target.value,
                        })}
                    placeholder="Tool call ID"
                    class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400"
                />
            </div>
        `
    );
};
