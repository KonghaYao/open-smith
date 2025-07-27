import html from "solid-js/html";
import { formatDateTime, formatFileSize } from "../utils.js";

// 单个附件项组件
export const AttachmentItem = (props) => {
    const { attachment } = props;

    return html`
        <div class="bg-green-50 p-3 rounded-lg">
            <div class="flex justify-between items-start mb-2">
                <span class="text-sm font-medium text-green-900"
                    >${attachment.filename || "Attachment"}</span
                >
                <span class="text-xs text-green-600"
                    >${formatDateTime(attachment.created_at)}</span
                >
            </div>
            <div class="text-sm text-green-700">
                类型: ${attachment.mime_type || "unknown"} | 大小:
                ${formatFileSize(attachment.size)}
            </div>
            ${attachment.metadata
                ? html`<div class="text-xs text-green-600 mt-1">
                      ${JSON.stringify(attachment.metadata)}
                  </div>`
                : ""}
        </div>
    `;
};
