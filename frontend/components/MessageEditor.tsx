import { X, Type, List, Trash2 } from "lucide-solid";

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
    return (
        <div class="space-y-3">
            {props.messages().map((message, index) => (
                <div class="bg-white border border-gray-200 rounded-lg p-3">
                    <div class="flex justify-between items-center mb-2">
                        <select
                            value={message.role}
                            onChange={(e) =>
                                props.onUpdateMessage(index, {
                                    ...message,
                                    role: (e.target as HTMLSelectElement).value,
                                })
                            }
                            class="font-semibold text-xs uppercase bg-transparent focus:outline-none">
                            {messageTypes.map((type) => (
                                <option
                                    value={type}
                                    selected={message.role === type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                        <div class="flex items-center space-x-2">
                            <button
                                onClick={() => {
                                    const newContent = isContentArray(
                                        message.content
                                    )
                                        ? contentArrayToString(message.content)
                                        : stringToContentArray(message.content);
                                    props.onUpdateMessage(index, {
                                        ...message,
                                        content: newContent,
                                    });
                                }}
                                class="p-1 text-gray-400 hover:text-blue-500"
                                title={
                                    isContentArray(message.content)
                                        ? "切换到文本模式"
                                        : "切换到数组模式"
                                }>
                                {isContentArray(message.content) ? (
                                    <Type></Type>
                                ) : (
                                    <List></List>
                                )}
                            </button>
                            <button
                                onClick={() => props.onRemoveMessage(index)}
                                class="p-1 text-gray-400 hover:text-red-500">
                                <Trash2 />
                            </button>
                        </div>
                    </div>

                    {MessageContentEditor({
                        message: message,
                        onUpdateMessage: props.onUpdateMessage,
                        index: index,
                        isContentArray: isContentArray,
                        createContentItem: createContentItem,
                        contentTypes: contentTypes,
                    })}
                    {ToolCallIdEditor({
                        message: message,
                        onUpdateMessage: props.onUpdateMessage,
                        index: index,
                    })}
                </div>
            ))}
        </div>
    );
};

// MessageContentEditor 组件
const MessageContentEditor = (props) => {
    return (
        <>
            {!isContentArray(props.message.content) ? (
                <textarea
                    value={props.message.content || ""}
                    onChange={(e) =>
                        props.onUpdateMessage(props.index, {
                            ...props.message,
                            content: (e.target as HTMLTextAreaElement).value,
                        })
                    }
                    placeholder="Enter a message content... Use {{variable}} for variables"
                    class="w-full p-2 border border-gray-300 rounded-md resize-y focus:ring-2 focus:ring-blue-400"
                    rows={3}
                />
            ) : (
                <div class="space-y-2">
                    {props.message.content.map(
                        (item: any, itemIndex: number) => (
                            <div
                                class="flex items-start space-x-2 p-2 border border-gray-200 rounded"
                                key={itemIndex}>
                                <select
                                    value={item.type}
                                    onChange={(e) => {
                                        const newContent = [
                                            ...props.message.content,
                                        ];
                                        const oldValue =
                                            item.type === "text"
                                                ? item.text
                                                : item.image_url?.url || "";
                                        newContent[itemIndex] =
                                            props.createContentItem(
                                                (e.target as HTMLSelectElement)
                                                    .value,
                                                oldValue
                                            );
                                        props.onUpdateMessage(props.index, {
                                            ...props.message,
                                            content: newContent,
                                        });
                                    }}
                                    class="text-sm border border-gray-300 rounded p-1">
                                    {props.contentTypes.map((type: string) => (
                                        <option
                                            value={type}
                                            selected={item.type === type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                                <div class="flex-1">
                                    {item.type === "text" && (
                                        <textarea
                                            value={item.text || ""}
                                            onChange={(e) => {
                                                const newContent = [
                                                    ...props.message.content,
                                                ];
                                                newContent[itemIndex] = {
                                                    ...item,
                                                    text: (
                                                        e.target as HTMLTextAreaElement
                                                    ).value,
                                                };
                                                props.onUpdateMessage(
                                                    props.index,
                                                    {
                                                        ...props.message,
                                                        content: newContent,
                                                    }
                                                );
                                            }}
                                            placeholder="Enter text content..."
                                            class="w-full p-2 border border-gray-300 rounded-md resize-y focus:ring-2 focus:ring-blue-400"
                                            rows={2}
                                        />
                                    )}
                                    {item.type === "image_url" && (
                                        <input
                                            type="text"
                                            value={item.image_url?.url || ""}
                                            onChange={(e) => {
                                                const newContent = [
                                                    ...props.message.content,
                                                ];
                                                newContent[itemIndex] = {
                                                    ...item,
                                                    image_url: {
                                                        url: (
                                                            e.target as HTMLInputElement
                                                        ).value,
                                                    },
                                                };
                                                props.onUpdateMessage(
                                                    props.index,
                                                    {
                                                        ...props.message,
                                                        content: newContent,
                                                    }
                                                );
                                            }}
                                            placeholder="Enter image URL..."
                                            class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400"
                                        />
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newContent =
                                            props.message.content.filter(
                                                (_: any, i: number) =>
                                                    i !== itemIndex
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
                                    title="删除内容项">
                                    <X></X>
                                </button>
                            </div>
                        )
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            const newContent = Array.isArray(
                                props.message.content
                            )
                                ? [...props.message.content]
                                : [];
                            newContent.push(
                                props.createContentItem("text", "")
                            );
                            props.onUpdateMessage(props.index, {
                                ...props.message,
                                content: newContent,
                            });
                        }}
                        class="w-full p-2 border border-dashed border-gray-300 rounded-md text-gray-500 hover:text-gray-700 hover:border-gray-400">
                        + 添加内容项
                    </button>
                </div>
            )}
        </>
    );
};

// ToolCallIdEditor 组件
const ToolCallIdEditor = (props) => {
    return (
        props.message.role === "tool" && (
            <div class="mt-2 space-y-2">
                <input
                    type="text"
                    value={props.message.tool_call_id || ""}
                    onChange={(e) =>
                        props.onUpdateMessage(props.index, {
                            ...props.message,
                            tool_call_id: (e.target as HTMLInputElement).value,
                        })
                    }
                    placeholder="Tool call ID"
                    class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400"
                />
            </div>
        )
    );
};
