import html from "solid-js/html";
import { formatDateTime } from "../utils.js";

// 单个反馈项组件
export const FeedbackItem = (props) => {
    const { feedback } = props;

    return html`
        <div class="bg-blue-50 p-3 rounded-lg">
            <div class="flex justify-between items-start mb-2">
                <span class="text-sm font-medium text-blue-900"
                    >评分: ${feedback.score || "N/A"}</span
                >
                <span class="text-xs text-blue-600"
                    >${formatDateTime(feedback.created_at)}</span
                >
            </div>
            ${feedback?.comment
                ? html`<div class="text-sm text-blue-800">
                      ${feedback.comment}
                  </div>`
                : ""}
        </div>
    `;
};
