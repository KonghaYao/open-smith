import { createMemo, createResource } from "solid-js";
import html from "solid-js/html";
import { AttachmentItem } from "../AttachmentItem.js";
import { GraphStateMessage, GraphStatePanel } from "../GraphState.js";
import { compile } from "json-schema-to-typescript-lite";
import { createStoreSignal } from "../../utils.js";
import { setDefaultMessage } from "../../PlayGround.js";
import { messagesToTemplate } from "../../types.js";

// 输入输出标签页组件
export const IOTab = ({ run, attachments }) => {
    const tools = createMemo(() => {
        const tools = JSON.parse(run.extra);
        return tools?.options?.tools;
    });
    const inputs = createMemo(() => {
        return JSON.parse(run.inputs);
    });
    const outputs = createMemo(() => {
        return JSON.parse(run.outputs);
    });

    return html`
        <div class="p-4 space-y-6">
            ${ToolsSection({ tools })} ${OutputsSection({ run, outputs })}
            ${InputsSection({ inputs })}
            ${attachments.length > 0
                ? html` <${AttachmentsSection} attachments=${attachments} /> `
                : ""}
        </div>
    `;
};

const ToolsSection = (props) => {
    return props.tools()
        ? html`
              <div>
                  <h4 class="font-semibold text-gray-900 mb-3">工具 (Tools)</h4>
                  <div class="bg-gray-50 rounded-lg p-4">
                      ${props.tools().map((tool) => {
                          const [schema] = createResource(async () => {
                              try {
                                  const schema = await compile(
                                      tool?.function?.parameters,
                                      "Demo",
                                  );
                                  return schema;
                              } catch (e) {
                                  return "";
                              }
                          });
                          const prefix = `/**\n * ${tool.function.description}\n */\n`;
                          return html`
                              <details>
                                  <summary
                                      class="border mb-2 bg-white shadow-sm cursor-pointer rounded-lg"
                                  >
                                      <div
                                          class="px-4 py-2 font-medium text-gray-700 bg-gray-100 rounded-t"
                                      >
                                          ${tool.function.name}
                                      </div>
                                  </summary>

                                  <pre class="text-sm p-4 whitespace-pre-wrap">
                                        <code>${() => prefix + schema()}</code>
                                      </pre
                                  >
                              </details>
                          `;
                      })}
                  </div>
              </div>
          `
        : "";
};

const OutputsSection = (props) => {
    const [outputReverse, setOutputReverse] = createStoreSignal(
        "outputReverse",
        false,
    );
    return html`
        <div>
            <h4
                class="font-semibold text-gray-900 mb-3 flex items-center justify-between"
            >
                输出 (Outputs)
                <button
                    class="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onclick=${() => setOutputReverse(!outputReverse())}
                >
                    ${outputReverse() ? "倒序" : "正序"}
                </button>
            </h4>
            ${props.run.error
                ? () => {
                      let error = props.run.error;
                      try {
                          error = JSON.parse(props.run.error);
                      } catch (e) {}
                      return html`
                          <div class="overflow-x-hidden">
                              <p
                                  class="text-red-500 text-sm whitespace-pre-wrap break-all"
                              >
                                  ${error}
                              </p>
                          </div>
                      `;
                  }
                : ""}
            <div class="bg-gray-50 rounded-lg p-4">
                ${props.outputs()
                    ? GraphStatePanel({ state: props.outputs() })
                    : html`
                          <div class="text-gray-500 text-sm">无输出数据</div>
                      `}
                ${() =>
                    props.run.run_type === "tool"
                        ? html`<pre class="text-gray-500 text-sm">
                                  ${props.outputs().output?.kwargs?.content}
                              </pre
                          >`
                        : ""}
                ${props.outputs()
                    ? GraphStateMessage({
                          state: {
                              messages:
                                  props
                                      .outputs()
                                      .generations?.[0]?.map(
                                          (i) => i.message,
                                      ) || [],
                          },
                          reverse: () => outputReverse(),
                      })
                    : ""}
            </div>
        </div>
    `;
};

const InputsSection = (props) => {
    const [inputReverse, setInputReverse] = createStoreSignal(
        "inputReverse",
        false,
    );
    return html`
        <div>
            <h4
                class="font-semibold text-gray-900 mb-3 flex items-center justify-between"
            >
                输入 (Inputs)
                <button
                    class="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onclick=${() => setInputReverse(!inputReverse())}
                >
                    ${inputReverse() ? "倒序" : "正序"}
                </button>
            </h4>
            <div class="bg-gray-50 rounded-lg p-4">
                ${props.inputs()
                    ? GraphStatePanel({ state: props.inputs() })
                    : html`
                          <div class="text-gray-500 text-sm">无输入数据</div>
                      `}
            </div>
            <div>
                ${props.inputs()
                    ? GraphStateMessage({
                          state: props.inputs(),
                          reverse: () => inputReverse(),
                          toPlayground: (props) => {
                              return html`<button
                                  onclick=${() => {
                                      setDefaultMessage(
                                          messagesToTemplate(props.messages),
                                      );
                                      // hash 改为 /playground
                                      window.location.hash = "/playground";
                                  }}
                              >
                                  设置默认消息
                              </button>`;
                          },
                      })
                    : ""}
            </div>
        </div>
    `;
};

const AttachmentsSection = (props) => {
    return html`
        <div>
            <h4 class="font-semibold text-gray-900 mb-3">
                附件 (${props.attachments.length})
            </h4>
            <div class="space-y-2">
                ${props.attachments.map((attachment) =>
                    AttachmentItem({ attachment }),
                )}
            </div>
        </div>
    `;
};
