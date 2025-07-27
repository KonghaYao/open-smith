import html from "solid-js/html";

export const TimeAgo = (props) => {
    const formatTime = () => {
        if (!props.datetime) return "";

        try {
            const now = new Date();
            const time = new Date(props.datetime);
            const diff = now - time;

            // 转换为秒
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            const months = Math.floor(days / 30);
            const years = Math.floor(months / 12);

            if (seconds < 60) {
                return seconds < 10 ? "刚刚" : `${seconds}秒前`;
            } else if (minutes < 60) {
                return `${minutes}分钟前`;
            } else if (hours < 24) {
                return `${hours}小时前`;
            } else if (days < 30) {
                return `${days}天前`;
            } else if (months < 12) {
                return `${months}个月前`;
            } else {
                return `${years}年前`;
            }
        } catch (error) {
            console.error("Time format error:", error);
            return props.datetime;
        }
    };

    return html`
        <span
            class="${props.class || "text-gray-400 text-xs"}"
            title="${props.datetime}"
        >
            ${formatTime()}
        </span>
    `;
};
