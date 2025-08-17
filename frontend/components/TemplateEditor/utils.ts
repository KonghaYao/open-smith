import type { MessagesTemplate } from "../../types.js";
type Content = MessagesTemplate["content"];

// Helper functions for content manipulation
export const isContentArray = (content: Content) => Array.isArray(content);
export const createContentItem = (type = "text", value = "") => {
    if (type === "text") return { type: "text", text: value };
    if (type === "image_url")
        return { type: "image_url", image_url: { url: value } };
    if (type === "audio_url")
        return { type: "audio_url", audio_url: { url: value } };
    return { type: "text", text: "" };
};
export const stringToContentArray = (content: Content) =>
    typeof content === "string"
        ? [createContentItem("text", content)]
        : content;
export const contentArrayToString = (content: Content) =>
    Array.isArray(content) && content.length === 1 && content[0].type === "text"
        ? content[0].text
        : content;
export const messageTypes = ["system", "human", "ai", "tool"];
export const contentTypes = ["text", "image_url", "audio_url"];
