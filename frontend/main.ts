import "virtual:uno.css";
import "@unocss/reset/tailwind.css";
import "@andypf/json-viewer/dist/iife/index.js";
import "./index.css";
import { render } from "solid-js/web";
import { App } from "./pages/app/index.jsx";
import { HashRouter, Route } from "@solidjs/router"; // 导入 Routes
import { Layout } from "./Layout.js";
import { LlmRecords } from "./pages/LlmRecords/index.jsx";
import { SystemsPage } from "./pages/SystemsPage.jsx";
import { PlayGround } from "./pages/PlayGround/index.jsx";
// 渲染应用
render(() => {
    return HashRouter({
        children: Route({
            path: "/",
            component: Layout,
            // 使用 Routes 包裹所有 Route
            children: [
                Route({
                    path: "/",
                    component: App, // 将 App 包裹在 Layout 中
                }),
                Route({
                    path: "/llm-records",
                    component: LlmRecords, // 将 OverviewPage 包裹在 Layout 中
                }),
                Route({
                    path: "/systems",
                    component: SystemsPage, // 将 SystemsPage selectedConfig包裹在 Layout 中
                }),
                Route({
                    path: "/playground",
                    component: PlayGround, // 将 PlayGround 包裹在 Layout 中
                }),
            ],
        }),
    });
}, document.getElementById("app")!);
