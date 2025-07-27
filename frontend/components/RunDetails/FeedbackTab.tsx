import type { RunRecord } from "../../../src/types.js";
import { formatDateTime } from "../../utils.jsx";

// 反馈标签页组件
export const FeedbackTab = (props: { run: RunRecord }) => {
    return (
        <div class="p-4">
            {props.run?.feedback?.length > 0 ? (
                <div>
                    <h4 class="font-semibold text-gray-900 mb-3">反馈</h4>
                    <div class="space-y-2">
                        {props.run?.feedback.map((feedbackItem) => (
                            <div class="bg-blue-50 p-3 rounded-lg">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-sm font-medium text-blue-900">
                                        评分: {feedbackItem.score || "N/A"}
                                    </span>
                                    <span class="text-xs text-blue-600">
                                        {formatDateTime(
                                            feedbackItem.created_at
                                        )}
                                    </span>
                                </div>
                                {feedbackItem?.comment ? (
                                    <div class="text-sm text-blue-800">
                                        {feedbackItem.comment}
                                    </div>
                                ) : (
                                    ""
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div class="text-center text-gray-500 py-8">暂无反馈数据</div>
            )}
        </div>
    );
};
