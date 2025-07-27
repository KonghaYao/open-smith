import { EventTimeline } from "./EventTimeline.js";
import type { RunRecord } from "../../../src/types.js";

// 事件标签页组件
export const EventsTab = (props: { run: RunRecord }) => {
    return (
        <div class="p-4">
            <h4 class="font-semibold text-gray-900 mb-3">事件时间线</h4>
            {props.run.events ? (
                <div class="bg-gray-50 rounded-lg p-4">
                    <EventTimeline events={props.run.events} />
                </div>
            ) : (
                <div class="text-center text-gray-500 py-8">暂无事件数据</div>
            )}
        </div>
    );
};
