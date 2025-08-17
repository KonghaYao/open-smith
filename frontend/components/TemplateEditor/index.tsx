import { For } from "solid-js";
import type { MessagesTemplate } from "../../types.js";
import { List, Trash2, Type, X } from "lucide-solid";
import {
    contentArrayToString,
    contentTypes,
    createContentItem,
    isContentArray,
    messageTypes,
    stringToContentArray,
} from "./utils.js";
import { TipTapEditor } from "./TipTapEditor.js";

export const TemplateEditor = (props: {
    messages: MessagesTemplate[];
    onUpdateMessage: (index: number, message: MessagesTemplate) => void;
    onRemoveMessage: (index: number) => void;
    variables: string[];
}) => {
    return (
        <div class="space-y-3">
            <For each={props.messages}>
                {(message, index) => (
                    <div class="bg-white border border-gray-200 rounded-lg p-3">
                        <div class="flex justify-between items-center mb-2">
                            <select
                                value={message.role}
                                onChange={(e) =>
                                    props.onUpdateMessage(index(), {
                                        ...message,
                                        role: e.currentTarget
                                            .value as MessagesTemplate["role"],
                                    })
                                }
                                class="font-semibold text-xs uppercase bg-transparent focus:outline-none"
                            >
                                {messageTypes.map((type) => (
                                    <option
                                        value={type}
                                        selected={message.role === type}
                                    >
                                        {type}
                                    </option>
                                ))}
                            </select>
                            <div class="flex items-center space-x-2">
                                <button
                                    onClick={() => {
                                        const newContent = isContentArray(
                                            message.content,
                                        )
                                            ? contentArrayToString(
                                                  message.content,
                                              )
                                            : stringToContentArray(
                                                  message.content,
                                              );
                                        props.onUpdateMessage(index(), {
                                            ...message,
                                            content: newContent!,
                                        });
                                    }}
                                    class="p-1 text-gray-400 hover:text-blue-500"
                                    title={
                                        isContentArray(message.content)
                                            ? "Switch to text mode"
                                            : "Switch to array mode"
                                    }
                                >
                                    {isContentArray(message.content) ? (
                                        <Type />
                                    ) : (
                                        <List />
                                    )}
                                </button>
                                <button
                                    onClick={() =>
                                        props.onRemoveMessage(index())
                                    }
                                    class="p-1 text-gray-400 hover:text-red-500"
                                >
                                    <Trash2 />
                                </button>
                            </div>
                        </div>
                        {typeof message.content === "string" ? (
                            <TipTapEditor
                                content={message.content}
                                onChange={(content) => {
                                    props.onUpdateMessage(index(), {
                                        ...message,
                                        content,
                                    });
                                }}
                                variables={props.variables}
                            />
                        ) : (
                            <div class="space-y-2">
                                {(message.content as any[]).map(
                                    (item, itemIndex) => (
                                        <div class="flex items-start space-x-2 p-2 border border-gray-200 rounded">
                                            <select
                                                value={item.type}
                                                onChange={(e) => {
                                                    const newContent = [
                                                        ...(message.content as any[]),
                                                    ];
                                                    const oldValue =
                                                        item.type === "text"
                                                            ? item.text
                                                            : item[item.type]
                                                                  ?.url || "";
                                                    newContent[itemIndex] =
                                                        createContentItem(
                                                            e.currentTarget
                                                                .value,
                                                            oldValue,
                                                        );
                                                    props.onUpdateMessage(
                                                        index(),
                                                        {
                                                            ...message,
                                                            content: newContent,
                                                        },
                                                    );
                                                }}
                                                class="text-sm border border-gray-300 rounded p-1"
                                            >
                                                {contentTypes.map((type) => (
                                                    <option
                                                        value={type}
                                                        selected={
                                                            item.type === type
                                                        }
                                                    >
                                                        {type}
                                                    </option>
                                                ))}
                                            </select>
                                            <div class="flex-1">
                                                {item.type === "text" && (
                                                    <TipTapEditor
                                                        content={
                                                            item.text || ""
                                                        }
                                                        onChange={(newText) => {
                                                            const newContent = [
                                                                ...(message.content as any[]),
                                                            ];
                                                            newContent[
                                                                itemIndex
                                                            ] = {
                                                                ...item,
                                                                text: newText,
                                                            };
                                                            props.onUpdateMessage(
                                                                index(),
                                                                {
                                                                    ...message,
                                                                    content:
                                                                        newContent,
                                                                },
                                                            );
                                                        }}
                                                        variables={
                                                            props.variables
                                                        }
                                                    />
                                                )}
                                                {(item.type === "image_url" ||
                                                    item.type ===
                                                        "audio_url") && (
                                                    <input
                                                        type="text"
                                                        value={
                                                            item[item.type]
                                                                ?.url || ""
                                                        }
                                                        onChange={(e) => {
                                                            const newContent = [
                                                                ...(message.content as any[]),
                                                            ];
                                                            newContent[
                                                                itemIndex
                                                            ] = {
                                                                ...item,
                                                                [item.type]: {
                                                                    url: e
                                                                        .currentTarget
                                                                        .value,
                                                                },
                                                            };
                                                            props.onUpdateMessage(
                                                                index(),
                                                                {
                                                                    ...message,
                                                                    content:
                                                                        newContent,
                                                                },
                                                            );
                                                        }}
                                                        placeholder={`Enter ${item.type.replace(
                                                            "_",
                                                            " ",
                                                        )}...`}
                                                        class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400"
                                                    />
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newContent = (
                                                        message.content as any[]
                                                    ).filter(
                                                        (_, i) =>
                                                            i !== itemIndex,
                                                    );
                                                    props.onUpdateMessage(
                                                        index(),
                                                        {
                                                            ...message,
                                                            content:
                                                                newContent.length >
                                                                0
                                                                    ? newContent
                                                                    : "",
                                                        },
                                                    );
                                                }}
                                                class="p-1 text-gray-400 hover:text-red-500"
                                                title="Remove content item"
                                            >
                                                <X />
                                            </button>
                                        </div>
                                    ),
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newContent = Array.isArray(
                                            message.content,
                                        )
                                            ? [...message.content]
                                            : [];
                                        newContent.push(
                                            createContentItem("text", ""),
                                        );
                                        props.onUpdateMessage(index(), {
                                            ...message,
                                            content: newContent,
                                        });
                                    }}
                                    class="w-full p-2 border border-dashed border-gray-300 rounded-md text-gray-500 hover:text-gray-700 hover:border-gray-400"
                                >
                                    + Add content item
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </For>
        </div>
    );
};
