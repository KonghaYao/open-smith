import { createSignal, createResource } from "solid-js";
import html from "solid-js/html";

export const SearchBar = (props) => {
    // 临时搜索值（用于输入框）
    const [tempSearchQuery, setTempSearchQuery] = createSignal(
        props.searchQuery() || "",
    );

    // 执行搜索
    const handleSearch = () => {
        const query = tempSearchQuery().trim();
        props.onSearchChange(query);
    };

    // 清除搜索
    const handleClear = () => {
        setTempSearchQuery("");
        props.onSearchChange("");
    };

    // 处理回车键搜索
    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    // 获取系统列表
    const [systems] = createResource(async () => {
        try {
            const response = await fetch("../trace/systems");
            if (!response.ok) throw new Error("Failed to load systems");
            const data = await response.json();
            return data.systems || [];
        } catch (error) {
            console.error("Error loading systems:", error);
            return [];
        }
    });

    return html`
        <div class="p-4 border-b border-gray-200">
            <h1 class="text-lg font-semibold text-gray-900 mb-4">会话监控</h1>

            <!-- 系统过滤器 -->
            <div class="mb-3">
                <select
                    value=${props.selectedSystem}
                    onchange=${(e) => props.onSystemChange(e?.target?.value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                    <option value="">全部系统</option>
                    ${() => {
                        return systems.loading
                            ? html`<option disabled>加载中...</option>`
                            : (systems() || []).map(
                                  (system) =>
                                      html`<option value=${system}>
                                          ${system}
                                      </option>`,
                              );
                    }}
                </select>
            </div>

            <!-- 搜索框 -->
            <div class="flex gap-2">
                <div class="relative flex-1">
                    <svg
                        class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        ></path>
                    </svg>
                    <input
                        type="text"
                        value=${tempSearchQuery}
                        oninput=${(e) => setTempSearchQuery(e?.target?.value)}
                        onkeypress=${handleKeyPress}
                        placeholder="搜索 Thread ID..."
                        class="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    ${() =>
                        tempSearchQuery() && tempSearchQuery().trim()
                            ? html`
                                  <button
                                      onclick=${handleClear}
                                      class="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
                                      title="清除搜索"
                                  >
                                      <svg
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                      >
                                          <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M6 18L18 6M6 6l12 12"
                                          ></path>
                                      </svg>
                                  </button>
                              `
                            : ""}
                </div>
                <button
                    onclick=${handleSearch}
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    title="搜索"
                >
                    <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        ></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
};
