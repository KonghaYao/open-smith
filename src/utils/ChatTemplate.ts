import {
    SystemMessage,
    HumanMessage,
    AIMessageChunk,
    ToolMessage,
    type MessageUnion,
    type BaseMessageLike,
} from "@langchain/core/messages";
import type { MessagesTemplate } from "../types.js";

export const createChatTemplate = (
    template: MessagesTemplate[]
): BaseMessageLike[] => {
    return template.map((i) => {
        switch (i.role) {
            case "system":
                /** @ts-ignore */
                return new SystemMessage(i.content);
            case "human":
                /** @ts-ignore */
                return new HumanMessage(i);
            case "ai":
                /** @ts-ignore */
                return new AIMessageChunk(i);
            case "tool":
                /** @ts-ignore */
                return new ToolMessage(i);
            default:
                return new HumanMessage(i.content as string);
        }
    });
};
export const messagesToTemplate = (
    messages: MessageUnion[]
): MessagesTemplate[] => {
    return messages.map((i: any) => {
        return {
            role: i.getType(),
            content: i.content,
            tool_calls: i.tool_calls,
            tool_call_id: i.tool_call_id,
            invalid_tool_calls: i.invalid_tool_calls,
        };
    });
};
