import html from "solid-js/html";
import { IOTab } from "./RunDetails/index.js";
import { onCleanup } from "solid-js";
import { RunDetails } from "./RunDetails.js";
import { createLucideIcon } from "../icons.js";

export const RunDetailsPanel = (props) => {
    // 点击外部关闭的逻辑
    const handleClickOutside = (event) => {
        const panel = document.getElementById("run-details-panel");
        if (panel && !panel.contains(event.target)) {
            props.onClose();
        }
    };

    // 在组件挂载时添加事件监听器，卸载时移除
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => {
        document.removeEventListener("mousedown", handleClickOutside);
    });

    return html`
        <div
            id="run-details-panel"
            class="fixed right-0 top-0 bottom-0 w-1/2 bg-white shadow-xl rounded-lg p-4 z-50 overflow-hidden"
        >
            <button
                onclick=${props.onClose}
                class="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
                ${createLucideIcon("X")}
            </button>
            ${RunDetails({
                selectedRunId: () => props.run.id,
                currentTraceData: () => ({
                    runs: [props.run],
                }),
                feedbacks: [],
                attachments: [],
            })}
        </div>
    `;
};
