import { createSignal, createResource, Show, For } from "solid-js";
import html from "solid-js/html";
import { createLucideIcon } from "./icons.js";
import { Table } from "./components/Table.js"; // 导入 Table 组件
import { getMasterKey } from "./utils/master-key-manager.js"; // 导入 getMasterKey

export const SystemsPage = () => {
    // 状态管理
    const [newSystemName, setNewSystemName] = createSignal("");
    const [newSystemDescription, setNewSystemDescription] = createSignal("");
    const [newSystemApiKey, setNewSystemApiKey] = createSignal(""); // 新增：API Key
    const [isCreating, setIsCreating] = createSignal(false);
    const [message, setMessage] = createSignal(null);
    const [refreshTrigger, setRefreshTrigger] = createSignal(0);

    // 辅助函数：获取认证头
    const getAuthHeaders = () => {
        const masterKey = getMasterKey(); // 调用新函数获取 MASTER_KEY
        if (masterKey) {
            return { Authorization: `Bearer ${masterKey}` };
        }
        return {};
    };

    // 获取系统列表
    const [systems, { refetch: refetchSystems }] = createResource(
        refreshTrigger,
        async () => {
            const response = await fetch("../admin/systems", {
                headers: getAuthHeaders(), // 添加认证头
            });
            if (!response.ok) {
                // 如果认证失败，可以显示更具体的错误信息
                if (response.status === 401) {
                    setMessage({
                        type: "error",
                        text: "未授权访问系统列表，请检查 MASTER_KEY",
                    });
                } else if (response.status === 500) {
                    setMessage({
                        type: "error",
                        text: "服务器配置错误，请联系管理员",
                    });
                } else {
                    setMessage({
                        type: "error",
                        text: `获取系统列表失败: HTTP error! status: ${response.status}`,
                    });
                }
                throw new Error(
                    `获取系统列表失败: HTTP error! status: ${response.status}`,
                );
            }
            const data = await response.json();
            return data.data || [];
        },
    );

    // 创建新系统
    const createSystem = async () => {
        const name = newSystemName().trim();
        const apiKey = newSystemApiKey().trim();

        if (!name) {
            setMessage({ type: "error", text: "系统名称不能为空" });
            return;
        }

        // 系统名称输入验证
        if (!/^[a-zA-Z0-9_-]{3,50}$/.test(name)) {
            setMessage({
                type: "error",
                text: "系统名称只能包含字母、数字、下划线和连字符，长度在 3 到 50 个字符之间。",
            });
            return;
        }

        // API Key 输入验证 (如果提供了)
        if (apiKey && !/^[a-zA-Z0-9-_]+$/.test(apiKey)) {
            setMessage({
                type: "error",
                text: "API Key 只能包含字母、数字和连字符。",
            });
            return;
        }

        setIsCreating(true);
        try {
            const response = await fetch("../admin/systems", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthHeaders(), // 合并认证头
                },
                body: JSON.stringify({
                    name: name,
                    description: newSystemDescription().trim() || null,
                    api_key: apiKey || undefined, // 传递 API Key，如果为空则不传递
                }),
            });

            const result = await response.json();
            if (result.success) {
                setMessage({ type: "success", text: "系统创建成功" });
                setNewSystemName("");
                setNewSystemDescription("");
                setNewSystemApiKey(""); // 清空 API Key 输入框
                setRefreshTrigger((t) => t + 1);
            } else {
                setMessage({
                    type: "error",
                    text: result.message || "创建失败",
                });
            }
        } catch (error) {
            setMessage({ type: "error", text: "网络错误：" + error.message });
        } finally {
            setIsCreating(false);
        }
    };

    // 删除系统
    const deleteSystem = async (systemId, systemName) => {
        if (!confirm(`确定要删除系统 "${systemName}" 吗？此操作不可撤销。`))
            return;

        try {
            const response = await fetch(`../admin/systems/${systemId}`, {
                method: "DELETE",
                headers: getAuthHeaders(), // 添加认证头
            });

            const result = await response.json();
            if (result.success) {
                setMessage({
                    type: "success",
                    text: `系统 "${systemName}" 已删除`,
                });
                setRefreshTrigger((t) => t + 1);
            } else {
                setMessage({
                    type: "error",
                    text: result.message || "删除失败",
                });
            }
        } catch (error) {
            setMessage({ type: "error", text: "网络错误：" + error.message });
        }
    };

    // 重新生成 API Key
    const regenerateApiKey = async (systemId) => {
        if (!confirm("确定要重新生成 API Key 吗？旧的 Key 将失效。")) return;

        try {
            const response = await fetch(
                `../admin/systems/${systemId}/regenerate-key`,
                {
                    method: "POST",
                    headers: getAuthHeaders(), // 添加认证头
                },
            );

            const result = await response.json();
            if (result.success) {
                setMessage({ type: "success", text: "API Key 重新生成成功" });
                setRefreshTrigger((t) => t + 1);
            } else {
                setMessage({
                    type: "error",
                    text: result.message || "重新生成失败",
                });
            }
        } catch (error) {
            setMessage({ type: "error", text: "网络错误：" + error.message });
        }
    };

    // 复制到剪贴板
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setMessage({ type: "success", text: "已复制到剪贴板" });
        } catch (error) {
            setMessage({ type: "error", text: "复制失败" });
        }
    };

    // 清除消息
    const clearMessage = () => setMessage(null);

    // 自动清除消息
    setTimeout(() => {
        if (message()) clearMessage();
    }, 5000);

    // 定义 Table 组件的列配置
    const systemsTableColumns = [
        {
            header: "系统信息",
            key: ["name", "description"], // 可以是数组，用于显示多个字段
            className: "px-6 py-4 whitespace-nowrap",
            format: (row) => html`
                <div>
                    <div class="text-sm font-medium text-gray-900">
                        ${row.name}
                    </div>
                    ${row.description &&
                    html`
                        <div class="text-sm text-gray-500">
                            ${row.description}
                        </div>
                    `}
                </div>
            `,
        },
        {
            header: "API Key",
            key: "api_key",
            className: "px-6 py-4 whitespace-nowrap",
            format: (row) => html`
                <div class="flex items-center gap-2">
                    <code
                        class="text-sm bg-gray-100 px-2 py-1 rounded font-mono"
                    >
                        ${row.api_key.substring(0, 8)}...
                    </code>
                    <button
                        onclick=${() => copyToClipboard(row.api_key)}
                        class="text-gray-400 hover:text-gray-600"
                        title="复制完整 API Key"
                    >
                        复制
                    </button>
                </div>
            `,
        },
        {
            header: "创建时间",
            key: "created_at",
            className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500",
            format: (row) => new Date(row.created_at).toLocaleString("zh-CN"),
        },
        {
            header: "操作",
            key: "id",
            className:
                "px-6 py-4 whitespace-nowrap text-right text-sm font-medium",
            format: (row) => html`
                <button
                    onclick=${() => regenerateApiKey(row.id)}
                    class="text-blue-600 hover:text-blue-900 mr-3"
                    title="重新生成 API Key"
                >
                    重置
                </button>
                <!-- 保障安全，则不使用删除功能 -->
            `,
        },
    ];

    return html`
        <div class="min-h-screen bg-gray-50 p-6">
            <div class="max-w-6xl mx-auto">
                <!-- 页面标题 -->
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900 mb-2">
                        系统管理
                    </h1>
                    <p class="text-gray-600">管理 API 系统和密钥</p>
                </div>

                <!-- 消息提示 -->
                ${() =>
                    Show({
                        when: message(),
                        children: () => html`
                            <div
                                class=${`mb-6 p-4 rounded-lg ${
                                    message()?.type === "error"
                                        ? "bg-red-50 border border-red-200 text-red-800"
                                        : "bg-green-50 border border-green-200 text-green-800"
                                }`}
                            >
                                <div class="flex justify-between items-center">
                                    <span>${message()?.text} </span>
                                    <button
                                        onclick=${clearMessage}
                                        class="text-gray-500 hover:text-gray-700"
                                    >
                                        ${createLucideIcon("x", "w-4 h-4")}
                                    </button>
                                </div>
                            </div>
                        `,
                    })}

                <!-- 创建新系统表单 -->
                <div
                    class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8"
                >
                    <h2 class="text-xl font-semibold text-gray-900 mb-4">
                        创建新系统
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-2"
                            >
                                系统名称 *
                            </label>
                            <input
                                type="text"
                                value=${newSystemName()}
                                oninput=${(e) =>
                                    setNewSystemName(e.target.value)}
                                placeholder="输入系统名称"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-2"
                            >
                                描述
                            </label>
                            <input
                                type="text"
                                value=${newSystemDescription()}
                                oninput=${(e) =>
                                    setNewSystemDescription(e.target.value)}
                                placeholder="输入系统描述（可选）"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label
                                class="block text-sm font-medium text-gray-700 mb-2"
                            >
                                API Key (可选)
                            </label>
                            <input
                                type="text"
                                value=${newSystemApiKey()}
                                oninput=${(e) =>
                                    setNewSystemApiKey(e.target.value)}
                                placeholder="留空则自动生成"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <div class="mt-4">
                        <button
                            onclick=${createSystem}
                            disabled=${isCreating()}
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            ${isCreating()
                                ? html`
                                      <div
                                          class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"
                                      ></div>
                                      创建中...
                                  `
                                : html` ${createLucideIcon("plus")} 创建系统 `}
                        </button>
                    </div>
                </div>

                <!-- 系统列表 -->
                <div
                    class="bg-white rounded-lg shadow-sm border border-gray-200"
                >
                    <div class="p-6 border-b border-gray-200">
                        <h2 class="text-xl font-semibold text-gray-900">
                            系统列表
                        </h2>
                    </div>
                    <div class="overflow-x-auto">
                        ${() =>
                            Table({
                                columnsConfig: systemsTableColumns,
                                data: systems(),
                                loading: systems.loading,
                                error: systems.error,
                                onRowClick: () => {},
                            })}
                    </div>
                </div>
            </div>
        </div>
    `;
};
