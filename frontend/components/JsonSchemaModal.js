import { createSignal, Show } from "solid-js";
import html from "solid-js/html";
import { createLucideIcon } from "../icons.js";

export const JsonSchemaModal = (props) => {
    const [localSchemaText, setLocalSchemaText] = createSignal(
        props.schemaText() || "",
    );
    const [jsonError, setJsonError] = createSignal("");

    // 内部处理 onchange 事件
    const handleSchemaChange = (e) => {
        const value = e.target.value;
        setLocalSchemaText(value);
        try {
            if (value.trim() === "") {
                setJsonError(""); // 允许空字符串
                return;
            }
            JSON.parse(value);
            setJsonError("");
        } catch (err) {
            setJsonError("JSON 格式错误: " + err.message);
        }
    };

    const handleSave = () => {
        if (jsonError()) {
            alert("请修正 JSON 格式错误再保存。");
            return;
        }
        props.onSave?.(localSchemaText());
        props.onClose?.();
    };

    const handleClose = () => {
        // 检查是否有未保存的更改
        if (localSchemaText() !== (props.schemaText() || "")) {
            if (!confirm("有未保存的更改，确定要关闭吗？")) {
                return;
            }
        }
        setLocalSchemaText(props.schemaText() || ""); // 恢复为原始值
        setJsonError(""); // 清除错误
        props.onClose?.();
    };

    return html`
        <!-- 弹窗内容 -->
        <div
            class="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg"
        >
            <!-- 头部 -->
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-gray-900 flex items-center">
                    ${createLucideIcon("code")}
                    <span class="ml-2">编辑输出 Schema</span>
                </h2>
                <button
                    onclick=${handleClose}
                    class="text-gray-400 hover:text-gray-600"
                >
                    ${createLucideIcon("x")}
                </button>
            </div>

            <!-- JSON Schema 编辑器 -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                    >JSON Schema</label
                >
                <textarea
                    value=${localSchemaText()}
                    oninput=${handleSchemaChange}
                    class=${"w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"}
                    rows="20"
                    placeholder="请输入 JSON Schema，例如: "
                ></textarea>
                ${Show({
                    when: jsonError,
                    children: () =>
                        html`<p class="text-red-500 text-sm mt-1">
                            ${jsonError()}
                        </p>`,
                })}
            </div>

            <!-- 操作按钮 -->
            <div
                class="flex justify-end space-x-4 pt-6 border-t border-gray-200 mt-6"
            >
                <button
                    onclick=${handleClose}
                    class="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    取消
                </button>
                <button
                    onclick=${handleSave}
                    class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    保存
                </button>
            </div>
        </div>
    `;
};
