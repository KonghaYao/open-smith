import { parseJSON, formatDateTime } from "../../utils.js";

// 事件时间线组件
export const EventTimeline = (props: { events: string }) => {
    const eventList = parseJSON(props.events) || [];

    return (
        <div class="space-y-3">
            {eventList.map((event: { name: string; time: string }) => {
                const eventClass = () => {
                    return (
                        `w-3 h-3 rounded-full ` +
                        (event.name === "start"
                            ? "bg-green-500"
                            : "bg-blue-500")
                    );
                };
                return (
                    <div class="flex items-center space-x-3">
                        <div class="flex-shrink-0">
                            <div class={eventClass()}></div>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center justify-between">
                                <span class="text-sm font-medium text-gray-900">
                                    {event.name}
                                </span>
                                <span class="text-xs text-gray-500">
                                    {formatDateTime(event.time)}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
