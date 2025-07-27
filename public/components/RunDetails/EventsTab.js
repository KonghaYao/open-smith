import html from "solid-js/html";
import { EventTimeline } from "./EventTimeline.js";

// 事件标签页组件
export const EventsTab = ({ run }) => {
    return html`
        <div class="p-4">
            <h4 class="font-semibold text-gray-900 mb-3">事件时间线</h4>
            ${run.events
                ? html`
                      <div class="bg-gray-50 rounded-lg p-4">
                          ${EventTimeline({ events: run.events })}
                      </div>
                  `
                : html`
                      <div class="text-center text-gray-500 py-8">
                          暂无事件数据
                      </div>
                  `}
        </div>
    `;
};
