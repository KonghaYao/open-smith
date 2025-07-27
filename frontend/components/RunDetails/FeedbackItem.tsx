import { formatDateTime } from "../../utils.jsx";
interface Feedback {
    score: number;
    created_at: string;
    comment: string;
}
// 单个反馈项组件
export const FeedbackItem = (props: { feedback: Feedback }) => {
    return (
        <div class="bg-blue-50 p-3 rounded-lg">
            <div class="flex justify-between items-start mb-2">
                <span class="text-sm font-medium text-blue-900">
                    评分: {props.feedback.score || "N/A"}
                </span>
                <span class="text-xs text-blue-600">
                    {formatDateTime(props.feedback.created_at)}
                </span>
            </div>
            {props.feedback?.comment ? (
                <div class="text-sm text-blue-800">
                    {props.feedback.comment}
                </div>
            ) : (
                ""
            )}
        </div>
    );
};
