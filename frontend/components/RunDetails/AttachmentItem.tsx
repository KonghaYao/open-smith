import { formatDateTime, formatFileSize } from "../../utils.jsx";
interface Attachment {
    filename: string;
    created_at: string;
    mime_type: string;
    size: number;
    metadata: Record<string, any>;
}

// 单个附件项组件
export const AttachmentItem = (props: { attachment: Attachment }) => {
    return (
        <div class="bg-green-50 p-3 rounded-lg">
            <div class="flex justify-between items-start mb-2">
                <span class="text-sm font-medium text-green-900">
                    {props.attachment.filename || "Attachment"}
                </span>
                <span class="text-xs text-green-600">
                    {formatDateTime(props.attachment.created_at)}
                </span>
            </div>
            <div class="text-sm text-green-700">
                类型: {props.attachment.mime_type || "unknown"} | 大小:
                {formatFileSize(props.attachment.size)}
            </div>
            {props.attachment.metadata ? (
                <div class="text-xs text-green-600 mt-1">
                    {JSON.stringify(props.attachment.metadata)}
                </div>
            ) : (
                ""
            )}
        </div>
    );
};
