import { formatTimestamp } from "../../utils.js";
import { StatsCard } from "./StatsCard.js";
import type { RunRecord } from "../../../src/types.js";

// 概览标签页组件
export const OverviewTab = (props: { run: RunRecord }) => {
    return (
        <div class="p-4 space-y-6">
            <div>
                <h4 class="font-semibold text-gray-900 mb-3">执行统计</h4>$
                {StatsCard({ run: props.run })}
            </div>

            <div>
                <h4 class="font-semibold text-gray-900 mb-3">基本信息</h4>
                <div class="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <span class="text-sm font-medium text-gray-600">
                                运行ID
                            </span>
                            <p class="text-sm text-gray-900 font-mono">
                                ${props.run.id}
                            </p>
                        </div>
                        <div>
                            <span class="text-sm font-medium text-gray-600">
                                Trace ID
                            </span>
                            <p class="text-sm text-gray-900 font-mono">
                                ${props.run.trace_id}
                            </p>
                        </div>
                        <div>
                            <span class="text-sm font-medium text-gray-600">
                                开始时间
                            </span>
                            <p class="text-sm text-gray-900">
                                ${formatTimestamp(props.run.start_time)}
                            </p>
                        </div>
                        <div>
                            <span class="text-sm font-medium text-gray-600">
                                结束时间
                            </span>
                            <p class="text-sm text-gray-900">
                                ${formatTimestamp(props.run.end_time)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {props.run.error ? (
                <div>
                    <h4 class="font-semibold text-gray-900 mb-3">错误信息</h4>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <pre class="text-sm text-red-800 whitespace-pre-wrap">
                            {props.run.error}
                        </pre>
                    </div>
                </div>
            ) : (
                ""
            )}
        </div>
    );
};
