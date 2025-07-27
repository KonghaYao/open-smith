import type { RunRecord } from "../../../src/database.js";
import { getRunType, getMetaDataOfRun, icon } from "../../utils.js";
import { createMemo } from "solid-js";

// 单个 Run 项组件
export const RunItem = (props: {
    run: RunRecord;
    onSelect: (id: string) => void;
    isSelected: () => boolean;
}) => {
    const handleClick = () => {
        props.onSelect(props.run.id);
    };
    const cardClass = () => {
        return `bg-white  rounded-lg cursor-pointer   ${
            props.isSelected() ? "ring-2 ring-blue-500 " : ""
        }`;
    };
    const metadata = createMemo(() => getMetaDataOfRun(props.run));

    const time = createMemo(() => {
        return (
            (Number(props.run.end_time) - Number(props.run.start_time)) / 1000
        );
    });
    const tokens = createMemo(() => {
        return props.run.total_tokens;
    });
    const modelName = createMemo(() => {
        return props.run.model_name;
    });
    // 改为 tsx 语法

    return (
        <div class={cardClass()} onClick={handleClick}>
            <div
                class="flex mb-2 flex-wrap"
                style={{
                    "padding-left": `${
                        calcLevelFromCheckpointNs(
                            props.run.name,
                            metadata(),
                            getRunType(props.run)
                        ) * 20
                    }px`,
                }}>
                <div class="text-gray-400 text-left">
                    {icon[getRunType(props.run)] ?? icon.unknown}
                </div>
                <div
                    class={`px-2 font-medium ${
                        props.run.error ? "text-red-500" : "text-gray-900"
                    }`}>
                    {props.run.name}
                </div>
                <div class="flex space-x-2 flex-wrap">
                    {time() ? (
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                            ⏱️ {time().toFixed(1)}s
                        </span>
                    ) : null}
                    {!!tokens() ? (
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                            🔢 {tokens()} tokens
                        </span>
                    ) : null}
                    {modelName() ? (
                        <div class="flex items-center space-x-2 text-xs text-gray-500">
                            <span class="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                {modelName()}
                            </span>
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                                {calcTpsFromRun(props.run).toFixed(0)} tps
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
export const calcTpsFromRun = (run: RunRecord) => {
    const data = JSON.parse(run.outputs || "{}");
    const totalTokens = data.generations
        .flat()
        .map((i: any) => i.message)
        .reduce((acc: number, cur: any) => {
            return acc + (cur?.kwargs?.usage_metadata?.output_tokens || 0);
        }, 0);
    /** @ts-ignore */
    const duration = run.end_time - run.start_time;
    return (totalTokens / duration) * 1000;
};

const calcLevelFromCheckpointNs = (
    name: string,
    metadata: any,
    type: string
) => {
    const checkpointNs = metadata.langgraph_checkpoint_ns;

    const addForType = () => {
        // return 0;
        if (type === "LangGraph") return 0;
        if (type === "CompiledStateGraph") return 0;
        if (type === "RunnableSequence")
            return name === "RunnableSequence" ? 1 : 0;
        if (type === "ChannelWrite") return 2;
        if (type === "ChatOpenAI") return 3;
        if (type === "RunnableLambda") return 3;
        if (type === "RunnableCallable") return 3;
        if (type === "DynamicStructuredTool") return 3;
        return 0;
    };
    if (!checkpointNs) return addForType();
    return addForType() + checkpointNs.split("|").length;
};
