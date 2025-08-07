import { createSignal, onCleanup, onMount, type JSXElement } from "solid-js";
import { Calendar, X } from "lucide-solid";

interface DateRangePickerProps {
    startTime: string;
    endTime: string;
    onStartTimeChange: (value: string) => void;
    onEndTimeChange: (value: string) => void;
}

export const DateRangePicker = (props: DateRangePickerProps): JSXElement => {
    const [isOpen, setIsOpen] = createSignal(false);
    let containerRef: HTMLDivElement | undefined;

    // 将 ISO 时间字符串转换为 datetime-local 输入框需要的格式
    const formatForInput = (isoDate: string) => {
        if (!isoDate) return "";
        const date = new Date(isoDate);
        // 转换为 YYYY-MM-DDTHH:mm 格式
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // 将 datetime-local 输入框的值转换为 ISO 字符串
    const formatToISO = (localDateTime: string) => {
        if (!localDateTime) return "";
        const date = new Date(localDateTime);
        return date.toISOString();
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (containerRef && !containerRef.contains(event.target as Node)) {
            setIsOpen(false);
        }
    };

    onMount(() => {
        document.addEventListener("mousedown", handleClickOutside);
    });

    onCleanup(() => {
        document.removeEventListener("mousedown", handleClickOutside);
    });

    const formatDisplayDate = (isoDate: string) => {
        if (!isoDate) return null;
        const date = new Date(isoDate);
        return date
            .toLocaleString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            })
            .replace(/\//g, "-");
    };

    const displayText = () => {
        const start = formatDisplayDate(props.startTime);
        const end = formatDisplayDate(props.endTime);
        if (start && end) return `${start} ~ ${end}`;
        if (start) return `从 ${start}`;
        if (end) return `至 ${end}`;
        return "选择时间范围";
    };

    return (
        <div class="relative col-span-1 lg:col-span-2" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen())}
                class="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors flex justify-between items-center">
                <span class="text-gray-700">{displayText()}</span>
                <Calendar class="w-4 h-4 text-gray-500" />
            </button>
            {isOpen() && (
                <div class="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 p-4">
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="text-md font-medium text-gray-800">
                            选择时间范围
                        </h4>
                        <button
                            onClick={() => setIsOpen(false)}
                            class="text-gray-400 hover:text-gray-600">
                            <X class="w-5 h-5" />
                        </button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                起始时间
                            </label>
                            <input
                                type="datetime-local"
                                class="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                value={formatForInput(props.startTime)}
                                onInput={(e) =>
                                    props.onStartTimeChange(
                                        formatToISO(e.currentTarget.value)
                                    )
                                }
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                结束时间
                            </label>
                            <input
                                type="datetime-local"
                                class="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                value={formatForInput(props.endTime)}
                                onInput={(e) =>
                                    props.onEndTimeChange(formatToISO(e.currentTarget.value))
                                }
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
