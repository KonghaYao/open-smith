import html from "solid-js/html";
import { FeedbackItem } from "../FeedbackItem.js";

// 反馈标签页组件
export const FeedbackTab = ({ feedback }) => {
    return html`
        <div class="p-4">
            ${feedback.length > 0
                ? html`
                      <div>
                          <h4 class="font-semibold text-gray-900 mb-3">反馈</h4>
                          <div class="space-y-2">
                              ${feedback.map((feedback) =>
                                  FeedbackItem({ feedback }),
                              )}
                          </div>
                      </div>
                  `
                : html`
                      <div class="text-center text-gray-500 py-8">
                          暂无反馈数据
                      </div>
                  `}
        </div>
    `;
};
