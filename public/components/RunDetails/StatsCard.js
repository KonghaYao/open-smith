import html from "solid-js/html";
import { formatFileSize } from "../../utils.js";
import { formatDuration } from "./utils.js";

// 统计信息组件
export const StatsCard = ({ run }) => {
    const duration = formatDuration(run.start_time, run.end_time);
    const inputSize = run.inputs ? new Blob([run.inputs]).size : 0;
    const outputSize = run.outputs ? new Blob([run.outputs]).size : 0;

    return html`
        <div class="grid grid-cols-2 gap-4">
            <div class="bg-blue-50 rounded-lg p-4">
                <div class="flex items-center">
                    <svg
                        class="w-5 h-5 text-blue-600 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <div>
                        <p class="text-sm font-medium text-blue-900">
                            执行时间
                        </p>
                        <p class="text-lg font-semibold text-blue-600">
                            ${duration}
                        </p>
                    </div>
                </div>
            </div>
            <div class="bg-green-50 rounded-lg p-4">
                <div class="flex items-center">
                    <svg
                        class="w-5 h-5 text-green-600 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <div>
                        <p class="text-sm font-medium text-green-900">
                            运行类型
                        </p>
                        <p class="text-lg font-semibold text-green-600">
                            ${run.run_type}
                        </p>
                    </div>
                </div>
            </div>
            <div class="bg-purple-50 rounded-lg p-4">
                <div class="flex items-center">
                    <svg
                        class="w-5 h-5 text-purple-600 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                        />
                    </svg>
                    <div>
                        <p class="text-sm font-medium text-purple-900">
                            输入大小
                        </p>
                        <p class="text-lg font-semibold text-purple-600">
                            ${formatFileSize(inputSize)}
                        </p>
                    </div>
                </div>
            </div>
            <div class="bg-orange-50 rounded-lg p-4">
                <div class="flex items-center">
                    <svg
                        class="w-5 h-5 text-orange-600 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                    </svg>
                    <div>
                        <p class="text-sm font-medium text-orange-900">
                            输出大小
                        </p>
                        <p class="text-lg font-semibold text-orange-600">
                            ${formatFileSize(outputSize)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
};
