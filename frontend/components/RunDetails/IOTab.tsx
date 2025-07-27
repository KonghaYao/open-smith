import { createMemo, createResource } from "solid-js";
import { GraphStateMessage, GraphStatePanel } from "../Graph/GraphState.jsx";
import { compile } from "https://esm.sh/json-schema-to-typescript-lite";

import {
    createStoreSignal,
    formatDateTime,
    formatFileSize,
} from "../../utils.js";
import { setDefaultMessage } from "../../pages/PlayGround/index.jsx";
import { messagesToTemplate } from "../../types.js";
import type { MessageTemplate } from "../../types.js";
import type { RunRecord, AttachmentRecord } from "../../../src/types.js";

// 输入输出标签页组件
export const IOTab = (props: { run: RunRecord }) => {
    const tools = createMemo(() => {
        const tools = JSON.parse(props.run.extra || "{}");
        return tools?.options?.tools;
    });
    const inputs = createMemo(() => {
        return JSON.parse(props.run.inputs || "{}");
    });
    const outputs = createMemo(() => {
        return JSON.parse(props.run.outputs || "{}");
    });

    return (
        <div class="p-4 space-y-6">
            <ToolsSection tools={tools} />
            <OutputsSection run={props.run} outputs={outputs} />
            <InputsSection inputs={inputs} />
            {props.run.attachments_count > 0 && (
                <AttachmentsSection attachments={props.run.attachments} />
            )}
        </div>
    );
};

const ToolsSection = (props: { tools: any }) => {
    return (
        <>
            {props.tools() ? (
                <div>
                    <h4 class="font-semibold text-gray-900 mb-3">
                        工具 (Tools)
                    </h4>
                    <div class="bg-gray-50 rounded-lg p-4">
                        {props.tools().map((tool: any) => {
                            const [schema] = createResource(async () => {
                                try {
                                    const schema = await compile(
                                        tool?.function?.parameters,
                                        "Demo"
                                    );
                                    return schema;
                                } catch (e) {
                                    return "";
                                }
                            });
                            const prefix = `/**\n * ${tool.function.description}\n */\n`;
                            return (
                                <details>
                                    <summary class="border mb-2 bg-white shadow-sm cursor-pointer rounded-lg">
                                        <div class="px-4 py-2 font-medium text-gray-700 bg-gray-100 rounded-t">
                                            {tool.function.name}
                                        </div>
                                    </summary>

                                    <pre class="text-sm p-4 whitespace-pre-wrap">
                                        <code>{prefix + schema()}</code>
                                    </pre>
                                </details>
                            );
                        })}
                    </div>
                </div>
            ) : (
                ""
            )}
        </>
    );
};

const OutputsSection = (props: { run: RunRecord; outputs: any }) => {
    const [outputReverse, setOutputReverse] = createStoreSignal(
        "outputReverse",
        false
    );
    return (
        <div>
            <h4 class="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                输出 (Outputs)
                <button
                    class="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={() => setOutputReverse(!outputReverse())}>
                    {outputReverse() ? "倒序" : "正序"}
                </button>
            </h4>
            {props.run.error
                ? (() => {
                      let error = props.run.error as string;
                      try {
                          error = JSON.parse(error);
                      } catch (e) {}
                      return (
                          <div class="overflow-x-hidden">
                              <p class="text-red-500 text-sm whitespace-pre-wrap break-all">
                                  {error}
                              </p>
                          </div>
                      );
                  })()
                : ""}
            <div class="bg-gray-50 rounded-lg p-4">
                {props.outputs() ? (
                    <GraphStatePanel state={props.outputs()} />
                ) : (
                    <div class="text-gray-500 text-sm">无输出数据</div>
                )}
                {props.run.run_type === "tool" ? (
                    <pre class="text-gray-500 text-sm">
                        {props.outputs().output?.kwargs?.content}
                    </pre>
                ) : (
                    ""
                )}
                {props.outputs() ? (
                    <GraphStateMessage
                        state={{
                            messages:
                                props
                                    .outputs()
                                    .generations?.[0]?.map(
                                        (i: any) => i.message
                                    ) || [],
                        }}
                        reverse={() => outputReverse()}
                    />
                ) : (
                    ""
                )}
            </div>
        </div>
    );
};

const InputsSection = (props: { inputs: any }) => {
    const [inputReverse, setInputReverse] = createStoreSignal(
        "inputReverse",
        false
    );
    return (
        <div>
            <h4 class="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                输入 (Inputs)
                <button
                    class="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={() => setInputReverse(!inputReverse())}>
                    {inputReverse() ? "倒序" : "正序"}
                </button>
            </h4>
            <div class="bg-gray-50 rounded-lg p-4">
                {props.inputs() ? (
                    <GraphStatePanel state={props.inputs()} />
                ) : (
                    <div class="text-gray-500 text-sm">无输入数据</div>
                )}
            </div>
            <div>
                {props.inputs() && (
                    <GraphStateMessage
                        state={props.inputs()}
                        reverse={() => inputReverse()}
                        toPlayground={(props) => {
                            return (
                                <button
                                    onClick={() => {
                                        setDefaultMessage(
                                            messagesToTemplate(
                                                props.messages as MessageTemplate[]
                                            )
                                        );
                                        // hash 改为 /playground
                                        window.location.hash = "/playground";
                                    }}>
                                    设置默认消息
                                </button>
                            );
                        }}
                    />
                )}
            </div>
        </div>
    );
};

const AttachmentsSection = (props: { attachments: AttachmentRecord[] }) => {
    return (
        <div>
            <h4 class="font-semibold text-gray-900 mb-3">
                附件 ({props.attachments.length})
            </h4>
            <div class="space-y-2">
                {props.attachments.map((attachment) => (
                    <div class="bg-green-50 p-3 rounded-lg">
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-sm font-medium text-green-900">
                                {attachment.filename || "Attachment"}
                            </span>
                            <span class="text-xs text-green-600">
                                {formatDateTime(attachment.created_at)}
                            </span>
                        </div>
                        <div class="text-sm text-green-700">
                            类型: {attachment.content_type || "unknown"} | 大小:
                            {formatFileSize(attachment.file_size)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
