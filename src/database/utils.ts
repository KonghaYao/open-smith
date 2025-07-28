import { v4 as uuidv4 } from "uuid";

export const formatTimestamp = (time: string | void) => {
    if (time) {
        return new Date(time).getTime().toFixed(0);
    }
    return;
};

// 生成API密钥的辅助方法
export const generateApiKey = (): string => {
    return `sk-${uuidv4().replace(/-/g, "")}`;
};

// 从 outputs 字段中提取 total_tokens 的辅助方法
export const extractTotalTokensFromOutputs = (
    outputs?: string | object
): number => {
    if (!outputs) return 0;
    try {
        const outputData =
            typeof outputs === "string" ? JSON.parse(outputs) : outputs;

        if (outputData?.llmOutput?.tokenUsage) {
            const result = outputData.llmOutput.tokenUsage.totalTokens;
            if (result === null || result === undefined) {
                // 如果 totalTokens 为 null 或 undefined，则赋值为 5
            }
            return result || 0;
        } else if (outputData.generations) {
            return outputData.generations.reduce((col: number, cur: any) => {
                const sum = cur
                    .map((i: any) => i.message)
                    .reduce((sum: number, i: any) => {
                        return (
                            sum + (i?.kwargs?.usage_metadata?.total_tokens || 0)
                        );
                    }, 0);
                return col + sum;
            }, 0);
        }
    } catch (error) {
        console.warn("解析 outputs 提取 total_tokens 时出错:", error);
    }
    return 0;
};

// 从 events 字段中提取 time_to_first_token 的辅助方法
export const extractTimeToFirstTokenFromEvents = (
    events?: string | object
): number => {
    if (!events) return 0;
    try {
        const eventsData =
            typeof events === "string" ? JSON.parse(events) : events;
        if (Array.isArray(eventsData) && eventsData.length >= 2) {
            const firstEventTime = new Date(eventsData[0].time).getTime();
            const secondEventTime = new Date(eventsData[1].time).getTime();
            return secondEventTime - firstEventTime;
        }
    } catch (error) {
        console.warn("解析 events 提取 time_to_first_token 时出错:", error);
    }
    return 0;
};

// 从 outputs 字段中提取 model_name 的辅助方法
export const extractModelNameFromOutputs = (
    outputs?: string | object
): string | undefined => {
    if (!outputs) return undefined;
    try {
        const outputData =
            typeof outputs === "string" ? JSON.parse(outputs) : outputs;
        const outputGenerations = outputData?.generations?.[0]?.[0];
        const model_name = (
            outputGenerations?.generationInfo ||
            outputGenerations?.generation_info
        )?.model_name;
        if (model_name) {
            return model_name;
        } else {
            const data = outputGenerations?.message?.kwargs;
            return (data?.response_metadata || data?.responseMetadata)
                ?.model_name;
        }
    } catch (error) {
        console.warn("解析 outputs 提取 model_name 时出错:", error);
        return undefined;
    }
};

// 从 extra 字段中提取 thread_id 的辅助方法
export const extractThreadIdFromExtra = (extra: any): string | undefined => {
    if (!extra) return undefined;

    try {
        const extraData = typeof extra === "string" ? JSON.parse(extra) : extra;
        return extraData?.metadata?.thread_id;
    } catch (error) {
        return undefined;
    }
};

// 从 extra 字段中提取 user_id 的辅助方法
export const extractUserIdFromExtra = (extra: any): string | undefined => {
    if (!extra) return undefined;

    try {
        const extraData = typeof extra === "string" ? JSON.parse(extra) : extra;
        return extraData?.metadata?.user_id;
    } catch (error) {
        return undefined;
    }
};
