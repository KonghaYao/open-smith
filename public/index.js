import { render } from "solid-js/web";
import { App } from "./app.js";
import { HashRouter, Route } from "@solidjs/router"; // 导入 Routes
import { Layout } from "./Layout.js";
import { OverviewPage } from "./overview.js";
import { SystemsPage } from "./SystemsPage.js";
import { PlayGround } from "./PlayGround.js";

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
                    path: "/overview",
                    component: OverviewPage, // 将 OverviewPage 包裹在 Layout 中
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
}, document.getElementById("app"));
