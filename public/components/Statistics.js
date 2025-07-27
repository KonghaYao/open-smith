import html from "solid-js/html";

export const Statistics = (props) => {
    return html`
        <div class="p-4 border-t border-gray-200 bg-gray-50">
            <div class="text-sm text-gray-600">
                ${() => {
                    const filteredThreadCount = props.filteredThreads().length;
                    const totalThreadCount = (props.threads() || []).length;

                    let result =
                        filteredThreadCount === totalThreadCount
                            ? `${totalThreadCount} 个会话`
                            : `${filteredThreadCount}/${totalThreadCount} 个会话`;

                    if (props.selectedThreadId()) {
                        const traceCount = props.filteredTraces().length;
                        result += ` | ${traceCount} 个多轮对话`;
                    }

                    return result;
                }}
            </div>
        </div>
    `;
};
