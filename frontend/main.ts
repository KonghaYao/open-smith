import "virtual:uno.css";
import "@unocss/reset/tailwind.css";
import "@andypf/json-viewer/dist/iife/index.js";
import "./index.css";
import { render } from "solid-js/web";

import { HashRouter, Route } from "@solidjs/router"; // 导入 Routes
import { Layout } from "./Layout.js";
import { lazy } from "solid-js";
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
                    component: lazy(() =>
                        import("./pages/app/index.jsx").then((res) => {
                            return { default: res.App };
                        })
                    ),
                }),
                Route({
                    path: "/llm-records",
                    component: lazy(() =>
                        import("./pages/LlmRecords/index.jsx").then((res) => {
                            return { default: res.LlmRecords };
                        })
                    ),
                }),
                Route({
                    path: "/systems",
                    component: lazy(() =>
                        import("./pages/SystemsPage.jsx").then((res) => {
                            return { default: res.SystemsPage };
                        })
                    ),
                }),
                Route({
                    path: "/playground",
                    component: lazy(() =>
                        import("./pages/PlayGround/index.jsx").then((res) => {
                            return { default: res.PlayGround };
                        })
                    ),
                }),
                Route({
                    path: "/stats",
                    component: lazy(() =>
                        import("./pages/StatsPage.jsx").then((res) => {
                            return { default: res.default };
                        })
                    ),
                }),
            ],
        }),
    });
}, document.getElementById("app")!);
