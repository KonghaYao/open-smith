import html from "solid-js/html";

// 元数据卡片组件
export const MetadataCard = ({ title, data, icon }) => {
    return html`
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <div class="flex items-center mb-3">
                ${icon}
                <h5 class="font-medium text-gray-900 ml-2">${title}</h5>
            </div>
            <div class="space-y-2">
                ${Object.entries(data).map(
                    ([key, value]) => html`
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-600">${key}</span>
                            <span
                                class="text-gray-900 font-mono text-xs break-all"
                                >${JSON.stringify(value)}</span
                            >
                        </div>
                    `,
                )}
            </div>
        </div>
    `;
};
