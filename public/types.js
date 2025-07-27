// Template 接口定义，对应后端的 Template 类型
export const createTemplate = (
    role,
    content,
    tool_calls = [],
    tool_call_id = "",
    invalid_tool_calls = [],
) => {
    return {
        role,
        content,
        tool_calls,
        tool_call_id,
        invalid_tool_calls,
    };
};

// 默认的空 Template
export const createEmptyTemplate = (role = "user") => {
    return createTemplate(role, "");
};

// 变量识别函数 - 使用特殊标签 {{var}} 替代 {var}
export const extractVariables = (content) => {
    if (typeof content === "string") {
        const matches = content.match(/\{\{(\w+)\}\}/g);
        if (!matches) return [];
        return matches.map((match) => match.slice(2, -2)); // 去掉 {{ 和 }}
    } else if (Array.isArray(content)) {
        // 处理数组格式的内容
        const vars = new Set();
        content.forEach((item) => {
            if (item.type === "text" && item.text) {
                const matches = item.text.match(/\{\{(\w+)\}\}/g);
                if (matches) {
                    matches.forEach((match) => vars.add(match.slice(2, -2)));
                }
            }
            // 也可以在 image_url 的 URL 中支持变量
            if (item.type === "image_url" && item.image_url?.url) {
                const matches = item.image_url.url.match(/\{\{(\w+)\}\}/g);
                if (matches) {
                    matches.forEach((match) => vars.add(match.slice(2, -2)));
                }
            }
        });
        return Array.from(vars);
    }
    return [];
};

// 从 Template 数组中提取所有变量
export const extractAllVariables = (templates) => {
    const vars = new Set();
    templates.forEach((template) => {
        if (typeof template.content === "string") {
            const templateVars = extractVariables(template.content);
            templateVars.forEach((v) => vars.add(v));
        } else if (Array.isArray(template.content)) {
            const templateVars = extractVariables(template.content);
            templateVars.forEach((v) => vars.add(v));
        }
    });
    return Array.from(vars);
};

// 替换内容中的变量
export const replaceVariables = (content, variables) => {
    if (typeof content === "string") {
        let result = content;
        Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
            result = result.replace(regex, value);
        });
        return result;
    } else if (Array.isArray(content)) {
        // 处理数组格式的内容
        return content.map((item) => {
            if (item.type === "text" && item.text) {
                let text = item.text;
                Object.entries(variables).forEach(([key, value]) => {
                    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
                    text = text.replace(regex, value);
                });
                return { ...item, text };
            } else if (item.type === "image_url" && item.image_url?.url) {
                let url = item.image_url.url;
                Object.entries(variables).forEach(([key, value]) => {
                    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
                    url = url.replace(regex, value);
                });
                return {
                    ...item,
                    image_url: { ...item.image_url, url },
                };
            }
            return item;
        });
    }
    return content;
};

export const messagesToTemplate = (messages) => {
    return messages.map((i) => {
        return {
            role: i.getType(),
            content: i.content,
            tool_calls: i.tool_calls,
            tool_call_id: i.tool_call_id,
            invalid_tool_calls: i.invalid_tool_calls,
        };
    });
};
