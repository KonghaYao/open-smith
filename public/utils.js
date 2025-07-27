import html from "solid-js/html";
import { createMemo, createSignal } from "solid-js";
// 格式化日期时间
export const formatDateTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

// 格式化文件大小
export const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// JSON 语法高亮
export const highlightJSON = (obj) => {
    if (typeof obj === "string") {
        try {
            obj = JSON.parse(obj);
        } catch (e) {
            return obj;
        }
    }

    let json = JSON.stringify(obj, null, 2);
    return html`<pre>${json}</pre>`;
};

const [userStore, _setUserStore] = createSignal(
    JSON.parse(localStorage.getItem("userStore") || JSON.stringify({})),
);

const setUserStore = (data) => {
    localStorage.setItem("userStore", JSON.stringify(data));
    _setUserStore(data);
};

const patchUserStore = (data) => {
    const store = userStore();
    setUserStore({ ...store, ...data });
};

export const createStoreSignal = (key, defaultValue) => {
    const value = createMemo(() => userStore()[key] || defaultValue);
    return [value, (v) => patchUserStore({ [key]: v })];
};
