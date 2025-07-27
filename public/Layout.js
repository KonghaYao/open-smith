import html from "solid-js/html";
import { For } from "solid-js";
import { createLucideIcon } from "./icons.js";

const menuItems = [
    {
        href: "#/",
        title: "主页",
        icon: createLucideIcon("workflow"),
    },
    {
        href: "#/overview",
        title: "数据概览",
        icon: createLucideIcon("chart-bar-big"),
    },
    {
        href: "#/systems",
        title: "系统管理",
        icon: createLucideIcon("key"),
    },
    {
        href: "#/playground",
        title: "大模型测试",
        icon: createLucideIcon("circle-play"),
    },
];

export const Layout = (props) => {
    const navLinks = For({
        each: menuItems,
        children: (item) => html`
            <a
                href=${item.href}
                class="flex items-center justify-center p-2 text-gray-700 hover:bg-gray-200 rounded-md transition-colors duration-200"
                title=${item.title}
            >
                ${item.icon}
            </a>
        `,
    });

    return html`
        <div class="flex h-screen bg-gray-100">
            <!-- 左侧菜单栏 -->
            <div
                class="w-20 bg-white shadow-lg flex flex-col p-4 border-r border-gray-200"
            >
                <nav class="flex flex-col space-y-4">
                    <div
                        class="text-3xl font-bold border-2 border-green-200 rounded-xl w-12 h-12 flex items-center justify-center mx-auto mb-4 select-none"
                        style="
                            letter-spacing: 0.1em;
                            background: linear-gradient(135deg, #f6fef8 0%, #e3f9e5 100%);
                        "
                        title="Parrot"
                    >
                        🦜
                    </div>
                    ${navLinks}
                </nav>
            </div>
            <!-- 内容区域 -->
            <div class="flex-1 overflow-auto">${props.children}</div>
        </div>
    `;
};
