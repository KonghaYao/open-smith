import { createSignal, For, Show } from "solid-js";
import html from "solid-js/html";
import { createLucideIcon } from "../icons.js";
import { createStoreSignal } from "../utils.js";

// 默认模型配置
const defaultModelConfig = {
    id: "",
    name: "",
    model_name: "gpt-3.5-turbo",
    provider_key: "",
    provider_url: "https://api.openai.com/v1",
    temperature: 0.7,
    top_p: 1,
    max_tokens: 30000,
};

// 空状态组件
const EmptyConfigState = () => html`
    <div class="text-center py-12 text-gray-500">
        <div class="mb-4">${createLucideIcon("database")}</div>
        <p>暂无模型配置，点击"新增配置"开始添加</p>
    </div>
`;

// 单个配置项组件
const ConfigItem = (props) => {
    return html`
        <div
            class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
            <div class="flex items-center justify-between">
                <div class="flex-1">
                    <div class="flex items-center mb-2">
                        <h4 class="font-semibold text-gray-900">
                            ${props.config.name}
                        </h4>
                        ${Show({
                            when:
                                props.selectedConfigId?.() === props.config.id,
                            children: () => html`
                                <span
                                    class="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                                >
                                    当前使用
                                </span>
                            `,
                        })}
                    </div>
                    <div class="text-sm text-gray-600 space-y-1">
                        <div>模型: ${props.config.model_name}</div>
                        <div>API: ${props.config.provider_url}</div>
                        <div>
                            温度: ${props.config.temperature} | Top P:
                            ${props.config.top_p} | 最大Token:
                            ${props.config.max_tokens}
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-2 ml-4">
                    <button
                        onclick=${() => props.onSelect?.(props.config)}
                        class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm"
                    >
                        选择
                    </button>
                    <button
                        onclick=${() => props.onEdit?.(props.config)}
                        class="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="编辑"
                    >
                        ${createLucideIcon("pencil")}
                    </button>
                    <button
                        onclick=${() => props.onDelete?.(props.config.id)}
                        class="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="删除"
                    >
                        ${createLucideIcon("trash-2")}
                    </button>
                </div>
            </div>
        </div>
    `;
};

// 配置列表组件
const ConfigList = (props) => {
    return html`
        <div class="mb-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-700">
                    已保存的配置
                </h3>
                <button
                    onclick=${props.onNew}
                    class="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                    ${createLucideIcon("plus")}
                    <span class="ml-2">新增配置</span>
                </button>
            </div>

            ${() =>
                Show({
                    when: props.configs().length === 0,
                    children: EmptyConfigState,
                    fallback: () => html`
                        <div class="grid gap-4">
                            ${props.configs().map((config) =>
                                ConfigItem({
                                    config,
                                    selectedConfigId: props.selectedConfigId,
                                    onSelect: props.onSelect,
                                    onEdit: props.onEdit,
                                    onDelete: props.onDelete,
                                }),
                            )}
                        </div>
                    `,
                })}
        </div>
    `;
};

// 输入字段组件
const InputField = (props) => {
    return html`
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                ${props.label} ${props.required ? "*" : ""}
            </label>
            <input
                type=${props.type ?? "text"}
                value=${props.value || ""}
                name=${props.name}
                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder=${props.placeholder || ""}
                min=${props.type === "number" ? props.min : undefined}
                max=${props.type === "number" ? props.max : undefined}
                step=${props.type === "number" ? props.step : undefined}
            />
            ${Show({
                when: props.error,
                children: () => html`
                    <p class="text-red-500 text-sm mt-1">${props.error}</p>
                `,
            })}
        </div>
    `;
};

// 定义模型配置字段的结构
const modelFields = [
    {
        label: "配置名称",
        key: "name",
        type: "text",
        placeholder: "例: OpenAI GPT-3.5",
        required: true,
        section: "basic",
    },
    {
        label: "模型名称",
        key: "model_name",
        type: "text",
        placeholder: "例: gpt-3.5-turbo",
        required: true,
        section: "basic",
    },
    {
        label: "API密钥",
        key: "provider_key",
        type: "password",
        placeholder: "输入API密钥",
        required: true,
        section: "basic",
    },
    {
        label: "API地址",
        key: "provider_url",
        type: "text",
        placeholder: "例: https://api.openai.com/v1",
        required: true,
        section: "basic",
    },
    {
        label: "温度 (0-2)",
        key: "temperature",
        type: "number",
        min: 0,
        max: 2,
        step: 0.1,
        section: "params",
    },
    {
        label: "Top P (0-1)",
        key: "top_p",
        type: "number",
        min: 0,
        max: 1,
        step: 0.1,
        section: "params",
    },
    {
        label: "最大Token",
        key: "max_tokens",
        type: "number",
        min: 1,
        section: "params",
    },
];

// 配置编辑表单组件
const ConfigEditForm = (props) => {
    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newConfig = { ...props.config() }; // 从初始配置拷贝 ID
        modelFields.forEach((field) => {
            let value = formData.get(field.key);
            if (field.type === "number") {
                value = parseFloat(value);
                if (isNaN(value)) value = undefined; // 处理空字符串或无效数字
            }
            newConfig[field.key] = value;
        });

        // 添加 ID，如果是新增配置
        if (!newConfig.id) {
            newConfig.id =
                Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        props.onSave(newConfig);
    };

    // 过滤出基本信息字段
    const basicFields = modelFields.filter(
        (field) => field.section === "basic",
    );
    // 过滤出参数配置字段
    const paramFields = modelFields.filter(
        (field) => field.section === "params",
    );

    return html`
        <form onsubmit=${handleSubmit} class="space-y-6">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-gray-700">
                    ${props.config()?.name ? "编辑配置" : "新增配置"}
                </h3>
                <button
                    type="button"
                    onclick=${props.onCancel}
                    class="text-gray-500 hover:text-gray-700"
                >
                    ${createLucideIcon("arrow-left")}
                    <span class="ml-1">返回</span>
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- 基本信息 -->
                <div class="space-y-4">
                    ${For({
                        each: basicFields,
                        children: (field) =>
                            InputField({
                                label: field.label,
                                type: field.type,
                                value: props.config()?.[field.key],
                                name: field.key,
                                placeholder: field.placeholder,
                                error: props.errors()[field.key],
                                required: field.required,
                            }),
                    })}
                </div>

                <!-- 参数配置 -->
                <div class="space-y-4">
                    ${For({
                        each: paramFields,
                        children: (field) =>
                            InputField({
                                label: field.label,
                                type: field.type,
                                value: props.config()?.[field.key],
                                name: field.key,
                                placeholder: field.placeholder,
                                error: props.errors()[field.key],
                                min: field.min,
                                max: field.max,
                                step: field.step,
                                required: field.required, // 确保所有字段都有 required 属性，以用于验证
                            }),
                    })}
                </div>
            </div>

            <!-- 操作按钮 -->
            <div
                class="flex justify-end space-x-4 pt-6 border-t border-gray-200"
            >
                <button
                    type="button"
                    onclick=${props.onCancel}
                    class="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    取消
                </button>
                <button
                    type="submit"
                    class="px-6 py-2 border border-blue-500 text-blue-500 rounded-lg hover:border-blue-600 hover:text-blue-600 transition-colors"
                >
                    保存
                </button>
            </div>
        </form>
    `;
};

export const ModelConfigModal = (props) => {
    const [selectedModelId, setSelectedModelId] = createStoreSignal(
        "selectedModelId",
        null,
    );
    const [modelConfigs, setModelConfigs] = createStoreSignal(
        "modelConfigs",
        [],
    );
    const [editingConfig, setEditingConfig] = createSignal(null);
    const [isEditing, setIsEditing] = createSignal(false);
    const [errors, setErrors] = createStoreSignal("errors", {});

    // 生成唯一ID
    const generateId = () =>
        Date.now().toString(36) + Math.random().toString(36).substr(2);

    // 验证配置
    const validateConfig = (config) => {
        const newErrors = {};
        if (!config.name?.trim()) newErrors.name = "请输入配置名称";
        if (!config.model_name?.trim()) newErrors.model_name = "请输入模型名称";
        if (!config.provider_key?.trim())
            newErrors.provider_key = "请输入API密钥";
        if (!config.provider_url?.trim())
            newErrors.provider_url = "请输入API地址";
        if (config.temperature < 0 || config.temperature > 2)
            newErrors.temperature = "温度范围: 0-2";
        if (config.top_p < 0 || config.top_p > 1)
            newErrors.top_p = "Top P范围: 0-1";
        if (config.max_tokens < 1) newErrors.max_tokens = "最大Token必须大于0";

        // 检查名称重复
        const existing = modelConfigs().find(
            (c) => c.name === config.name && c.id !== config.id,
        );
        if (existing) newErrors.name = "配置名称已存在";

        return newErrors;
    };

    // 开始新建配置
    const startNewConfig = () => {
        setEditingConfig({ ...defaultModelConfig, id: generateId() });
        setIsEditing(true);
        setErrors({});
    };

    // 开始编辑配置
    const startEditConfig = (config) => {
        setEditingConfig({ ...config });
        setIsEditing(true);
        setErrors({});
    };

    // 保存配置
    const saveConfig = (config) => {
        const validationErrors = validateConfig(config);

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setErrors({}); // 清除所有错误

        const configs = modelConfigs();
        const existingIndex = configs.findIndex((c) => c.id === config.id);

        let newConfigs;
        if (existingIndex >= 0) {
            // 更新现有配置
            newConfigs = [...configs];
            newConfigs[existingIndex] = config;
        } else {
            // 添加新配置
            newConfigs = [...configs, config];
        }

        setModelConfigs(newConfigs);
        cancelEdit();
    };

    // 取消编辑
    const cancelEdit = () => {
        setEditingConfig(null);
        setIsEditing(false);
        setErrors({});
    };

    // 删除配置
    const deleteConfig = (configId) => {
        if (confirm("确定要删除这个模型配置吗？")) {
            const newConfigs = modelConfigs().filter((c) => c.id !== configId);
            setModelConfigs(newConfigs);

            // 如果删除的是当前选中的配置，清空选择
            if (props.selectedConfigId?.() === configId) {
                setSelectedModelId(null);
            }
        }
    };

    // 选择配置
    const selectConfig = (config) => {
        setSelectedModelId(config.id);
        props.onClose?.();
    };

    // 关闭弹窗
    const handleClose = () => {
        if (isEditing()) {
            if (confirm("有未保存的更改，确定要关闭吗？")) {
                cancelEdit();
                props.onClose?.();
            }
        } else {
            props.onClose?.();
        }
    };

    const hidden = () => {
        return !props.isOpen();
    };
    return html`
        <div
            class=${() =>
                hidden() ? "hidden" : "fixed inset-0 z-50 overflow-y-auto"}
        >
            <div
                class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0"
            >
                <div
                    class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                    onclick=${handleClose}
                ></div>

                <!-- 弹窗内容 -->
                <div
                    class="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg"
                >
                    <!-- 头部 -->
                    <div class="flex items-center justify-between mb-6">
                        <h2
                            class="text-xl font-bold text-gray-900 flex items-center"
                        >
                            ${createLucideIcon("settings")}
                            <span class="ml-2">模型配置管理</span>
                        </h2>
                        <button
                            onclick=${handleClose}
                            class="text-gray-400 hover:text-gray-600"
                        >
                            ${createLucideIcon("x")}
                        </button>
                    </div>

                    ${() =>
                        !isEditing() &&
                        ConfigList({
                            configs: modelConfigs,
                            selectedConfigId: selectedModelId,
                            onSelect: selectConfig,
                            onEdit: startEditConfig,
                            onDelete: deleteConfig,
                            onNew: startNewConfig,
                        })}
                    ${() =>
                        isEditing() &&
                        ConfigEditForm({
                            config: editingConfig,
                            errors: errors,
                            onSave: saveConfig,
                            onCancel: cancelEdit,
                            validateConfig: validateConfig,
                            setErrors: setErrors,
                        })}
                </div>
            </div>
        </div>
    `;
};
