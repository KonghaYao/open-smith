import { FeedbackItem } from "./FeedbackItem.jsx";
import type { RunRecord } from "../../../src/database.js";

// 反馈标签页组件
export const FeedbackTab = (props: { run: RunRecord }) => {
    return (
        <div class="p-4">
            {props.run?.feedback?.length > 0 ? (
                <div>
                    <h4 class="font-semibold text-gray-900 mb-3">反馈</h4>
                    <div class="space-y-2">
                        {props.run?.feedback.map((feedbackItem) => (
                            <FeedbackItem feedback={feedbackItem} />
                        ))}
                    </div>
                </div>
            ) : (
                <div class="text-center text-gray-500 py-8">暂无反馈数据</div>
            )}
        </div>
    );
};
