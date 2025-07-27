import { Search } from "lucide-solid";
import { createSignal, createResource } from "solid-js";
import { ofetch } from "../../api.js";

interface SearchBarProps {
    selectedSystem: string;
    searchQuery: string;
    onSystemChange: (system: string) => void;
    onSearchChange: (query: string) => void;
}

export const SearchBar = (props: SearchBarProps) => {
    // 临时搜索值（用于输入框）
    const [tempSearchQuery, setTempSearchQuery] = createSignal(
        props.searchQuery || ""
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
    const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    // 获取系统列表
    const [systems] = createResource(async () => {
        try {
            const response = await ofetch("/trace/systems");
            return response.success ? response.systems : [];
        } catch (error) {
            console.error("Error loading systems:", error);
            return [];
        }
    });

    return (
        <div class="p-4 border-b border-gray-200">
            <h1 class="text-lg font-semibold text-gray-900 mb-4">会话监控</h1>

            {/* 系统过滤器 */}
            <div class="mb-3">
                <select
                    value={props.selectedSystem}
                    onChange={(e: Event) =>
                        props.onSystemChange(
                            (e.target as HTMLSelectElement)?.value
                        )
                    }
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                    <option value="">全部系统</option>
                    {systems.loading ? (
                        <option disabled>加载中...</option>
                    ) : (
                        (systems() || []).map((system: string) => (
                            <option value={system}>{system}</option>
                        ))
                    )}
                </select>
            </div>

            {/* 搜索框 */}
            <div class="flex gap-2">
                <div class="relative flex-1">
                    <svg
                        class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <input
                        type="text"
                        value={tempSearchQuery()}
                        onInput={(e: Event) =>
                            setTempSearchQuery(
                                (e.target as HTMLInputElement)?.value
                            )
                        }
                        onKeyPress={handleKeyPress}
                        placeholder="搜索 Thread ID..."
                        class="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {tempSearchQuery() && tempSearchQuery().trim() ? (
                        <button
                            onClick={handleClear}
                            class="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
                            title="清除搜索">
                            <svg
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    ) : null}
                </div>
                <button
                    onClick={handleSearch}
                    class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    title="搜索">
                    <Search></Search>
                </button>
            </div>
        </div>
    );
};
