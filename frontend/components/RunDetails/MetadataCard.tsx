import type { JSX } from "solid-js";

// 元数据卡片组件
export const MetadataCard = (props: {
    title: string;
    data: Record<string, any>;
    icon: JSX.Element;
}) => {
    return (
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <div class="flex items-center mb-3">
                {props.icon}
                <h5 class="font-medium text-gray-900 ml-2">{props.title}</h5>
            </div>
            <div class="space-y-2">
                {Object.entries(props.data).map(([key, value]) => (
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-600">{key}</span>
                        <span class="text-gray-900 font-mono text-xs break-all">
                            {JSON.stringify(value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
