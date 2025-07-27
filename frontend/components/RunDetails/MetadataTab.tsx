import { MetadataCard } from "./MetadataCard.js";
import { Settings } from "lucide-solid";
// 元数据标签页组件
export const MetadataTab = (props: { extraData: any }) => {
    return (
        <div class="p-4 space-y-6">
            {props.extraData ? (
                <div class="flex flex-col gap-6">
                    {props.extraData.metadata
                        ? MetadataCard({
                              title: "元数据",
                              data: props.extraData.metadata,
                              icon: <Settings />,
                          })
                        : ""}
                    {props.extraData.runtime
                        ? MetadataCard({
                              title: "运行时信息",
                              data: props.extraData.runtime,
                              icon: <Settings />,
                          })
                        : ""}
                </div>
            ) : (
                <div class="text-center text-gray-500 py-8">暂无元数据</div>
            )}
        </div>
    );
};
