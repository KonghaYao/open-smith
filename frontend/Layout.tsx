import { For, type JSXElement } from "solid-js";
import {
    Workflow,
    ChartBarBig,
    Key,
    CirclePlay,
    MessageSquareCode,
    TrendingUp,
    BarChart3,
    Activity,
} from "lucide-solid";

const menuItems = [
    {
        href: "#/",
        title: "主页",
        icon: <Workflow />,
    },
    {
        href: "#/llm-records",
        title: "数据概览",
        icon: <MessageSquareCode />,
    },
    {
        href: "#/stats",
        title: "统计分析",
        icon: <ChartBarBig />,
    },
    {
        href: "#/trends",
        title: "趋势分析",
        icon: <TrendingUp />,
    },
    {
        href: "#/performance",
        title: "性能对比",
        icon: <BarChart3 />,
    },
    {
        href: "#/anomaly",
        title: "异常检测",
        icon: <Activity />,
    },
    {
        href: "#/systems",
        title: "系统管理",
        icon: <Key />,
    },
    {
        href: "#/playground",
        title: "大模型测试",
        icon: <CirclePlay />,
    },
];

interface LayoutProps {
    children?: JSXElement;
}

export const Layout = (props: LayoutProps) => {
    const navLinks = For({
        each: menuItems,
        children: (item) => (
            <a
                href={item.href}
                class="flex items-center justify-center p-2 text-gray-700 hover:bg-gray-200 rounded-md transition-colors duration-200"
                title={item.title}>
                {item.icon}
            </a>
        ),
    });

    return (
        <div class="flex h-screen bg-gray-100">
            {/* 左侧菜单栏 */}
            <div class="w-20 bg-white shadow-lg flex flex-col p-4 border-r border-gray-200">
                <nav class="flex flex-col space-y-4">
                    <div
                        class="text-3xl font-bold border-2 border-green-200 rounded-xl w-12 h-12 flex items-center justify-center mx-auto mb-4 select-none"
                        style="
                            letter-spacing: 0.1em;
                            background: linear-gradient(135deg, #f6fef8 0%, #e3f9e5 100%);
                        "
                        title="Parrot">
                        🦜
                    </div>
                    {navLinks}
                </nav>
            </div>
            {/* 内容区域 */}
            <div class="flex-1 overflow-auto">{props.children}</div>
        </div>
    );
};
