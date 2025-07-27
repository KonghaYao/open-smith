import type { TraceOverview } from "../../../src/types.js";
import { TimeAgo } from "../../components/TimeAgo.jsx";

export const ThreadItem = (props: {
    thread: TraceOverview;
    isSelected: () => boolean;
    onSelect: (threadId: string) => void;
}) => {
    const Header = () => {
        return `thread-item card-hover p-3 m-2 bg-white border-2 rounded-lg cursor-pointer flex ${
            props.isSelected() ? "border-blue-500" : "border-gray-200"
        }`;
    };
    return (
        <div
            onClick={() => props.onSelect(props.thread.thread_id!)}
            class={Header()}>
            <div class="font-mono text-sm text-gray-800 truncate">
                ID: {props.thread.thread_id}
            </div>
            <span class="text-xs text-gray-500 flex-none mr-2">
                {props.thread.total_runs || 0} runs
            </span>
            <div class="flex-none text-xs">
                <TimeAgo
                    datetime={props.thread.last_run_time}
                    class="text-gray-500 text-xs"
                />
            </div>
        </div>
    );
};
