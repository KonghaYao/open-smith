import { createMemo, createEffect, createResource } from "solid-js";
import html from "solid-js/html";
import { load } from "https://esm.run/@langchain/core/dist/load/index.js";
import * as Messages from "https://esm.run/@langchain/core/dist/messages/index.js";

export const GraphStatePanel = (props) => {
    const state = createMemo(() => {
        const data = { ...props.state };
        delete data.messages;
        return data;
    });
    return JSONViewer({ data: state() });
};

export const GraphStateMessage = (props) => {
    const [LCMessage, { refetch }] = createResource(
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
                                    return new Messages.AIMessage(i);
                                case "human":
                                    return new Messages.HumanMessage(i);
                                case "system":
                                    return new Messages.SystemMessage(i);
                                case "tool":
                                    return new Messages.ToolMessage(i);
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
                                    messages: Messages,
                                },
                            },
                        });
                    }),
                );
                return LangChainMessages;
            } catch (error) {
                console.error(error);
                return [];
            }
        },
        {
            initialValue: [],
        },
    );
    createEffect(() => {
        if (props.state.messages?.length) {
            refetch();
        }
    });
    const message = createMemo(() => {
        if (props.reverse()) {
            return [...LCMessage()].reverse();
        }
        return LCMessage();
    });
    return html`<div class="space-y-4 p-4">
        ${() => props?.toPlayground?.({ messages: message() })}
        ${() =>
            LCMessage.loading
                ? html`<div
                      class="flex items-center justify-center p-8 text-gray-500"
                  >
                      <div
                          class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"
                      ></div>
                      加载中...
                  </div>`
                : message().map((i) => {
                      if (!i._getType) {
                          console.warn("Unknown message type", i);
                          return html`<div
                              class="bg-red-50 border border-red-200 rounded-lg p-4"
                          >
                              <div class="text-red-600 font-medium mb-2">
                                  未知消息类型
                              </div>
                              <pre
                                  class="text-sm text-red-700 whitespace-pre-wrap"
                              >
${JSON.stringify(i, null, 2)}</pre
                              >
                          </div>`;
                      }
                      if (i["_getType"]() === "ai") {
                          return html`<div
                              class="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden"
                          >
                              <div
                                  class="bg-blue-100 px-4 py-2 border-b border-blue-200"
                              >
                                  <span
                                      class="text-blue-700 font-medium text-sm"
                                      >🤖 AI 助手</span
                                  >
                              </div>
                              <div class="p-4 space-y-3">
                                  ${i.content &&
                                  html`<div class="text-gray-800">
                                      ${ContentViewer({ content: i.content })}
                                  </div>`}
                                  ${i.tool_calls &&
                                  i.tool_calls.map((toolCall) => {
                                      return html`<div
                                          class="bg-white border border-gray-200 rounded-md p-3"
                                      >
                                          <div
                                              class="text-sm font-medium text-gray-600 mb-2"
                                          >
                                              🔧 工具调用: ${toolCall.name}
                                          </div>
                                          ${JSONViewer({
                                              data: toolCall.args,
                                          })}
                                      </div>`;
                                  })}
                              </div>
                          </div>`;
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
                          return html`<div class="${PanelClass}">
                              <div class="${SubPanelClass}">
                                  <span class="${TextClass}">
                                      ${isSystem ? "⚙️ 系统" : "👤 用户"}
                                  </span>
                              </div>
                              <div class="p-4 text-gray-800">
                                  ${ContentViewer({ content: i.content })}
                              </div>
                          </div>`;
                      } else if (i["_getType"]() === "tool") {
                          return html`<div
                              class="bg-purple-50 border border-purple-200 rounded-lg overflow-hidden"
                          >
                              <div
                                  class="bg-purple-100 px-4 py-2 border-b border-purple-200"
                              >
                                  <span
                                      class="text-purple-700 font-medium text-sm"
                                      >🔧 工具结果</span
                                  >
                              </div>
                              <div class="p-4 text-gray-800">
                                  ${ContentViewer({ content: i.content })}
                              </div>
                          </div>`;
                      } else {
                          return html`<div
                              class="bg-gray-50 border border-gray-200 rounded-lg p-4"
                          >
                              <div class="text-gray-600 font-medium mb-2">
                                  其他消息类型
                              </div>
                              <pre
                                  class="text-sm text-gray-700 whitespace-pre-wrap"
                              >
${JSON.stringify(i, null, 2)}</pre
                              >
                          </div>`;
                      }
                  })}
    </div>`;
};

const ContentViewer = (props) => {
    // console.log(props.content);
    if (typeof props.content === "string") {
        return html`<div class="whitespace-pre-wrap break-words">
            ${props.content}
        </div>`;
    } else if (Array.isArray(props.content)) {
        return html`<div class="space-y-2">
            ${props.content.map((i) => ContentViewer({ content: i }))}
        </div>`;
    } else if (typeof props.content === "object") {
        if (props.content.type === "text") {
            return html`<div class="whitespace-pre-wrap break-words">
                ${props.content.text}
            </div>`;
        } else if (props.content.type === "image_url") {
            const imageUrl = props.content.image_url.url;
            if (imageUrl.startsWith("data:image")) {
                // 如果是base64编码的图片，直接显示
                return html`<div
                    class="bg-gray-100 border border-gray-300 rounded-md p-3 text-center"
                >
                    <div class="text-sm text-gray-600 mb-2">📷 图片:</div>
                    <img
                        src="${imageUrl}"
                        class="max-w-full h-auto"
                        alt="Embedded Image"
                    />
                </div>`;
            } else {
                // 否则，显示链接
                return html`<div
                    class="bg-gray-100 border border-gray-300 rounded-md p-3"
                >
                    <div class="text-sm text-gray-600 mb-2">📷 图片链接:</div>
                    <a
                        href="${imageUrl}"
                        target="_blank"
                        class="text-blue-600 hover:text-blue-800 underline text-sm break-all"
                    >
                        ${imageUrl}
                    </a>
                </div>`;
            }
        } else {
            return html`<div
                class="bg-gray-100 border border-gray-300 rounded-md p-3"
            >
                <div class="text-sm text-gray-600 mb-2">📄 对象数据:</div>
                <pre
                    class="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto"
                >
${JSON.stringify(props.content, null, 2)}</pre
                >
            </div>`;
        }
    } else {
        return html`<div class="text-gray-700">${props.content}</div>`;
    }
};

export const JSONViewer = (props) => {
    return html`<andypf-json-viewer
        indent="4"
        expanded="4"
        theme="default-light"
        show-data-types="false"
        show-toolbar="false"
        expand-icon-type="circle"
        show-copy="true"
        show-size="true"
        data=${props.data}
    >
    </andypf-json-viewer>`;
};
