import html from "solid-js/html";

export const createLucideIcon = (name, whiteTheme = false) => {
    const url = `https://unpkg.com/lucide-static@0.525.0/icons/${name}.svg`;
    return html`<img
        src=${url}
        class="w-6 h-6"
        style=${() => (whiteTheme ? "filter: invert(1)" : "")}
    />`;
};
