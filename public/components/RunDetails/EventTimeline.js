import html from "solid-js/html";
import { parseJSON, formatTimestamp } from "./utils.js";
import { formatDateTime } from "../../utils.js";

// 事件时间线组件
export const EventTimeline = ({ events }) => {
    const eventList = parseJSON(events) || [];

    return html`
        <div class="space-y-3">
            ${eventList.map((event, index) => {
                const eventClass = () => {
                    return `w-3 h-3 rounded-full ${
                        event.name === "start" ? "bg-green-500" : "bg-blue-500"
                    }`;
                };
                return html`
                    <div class="flex items-center space-x-3">
                        <div class="flex-shrink-0">
                            <div class=${eventClass()}></div>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center justify-between">
                                <span class="text-sm font-medium text-gray-900"
                                    >${event.name}</span
                                >
                                <span class="text-xs text-gray-500"
                                    >${formatDateTime(event.time)}</span
                                >
                            </div>
                        </div>
                    </div>
                `;
            })}
        </div>
    `;
};
