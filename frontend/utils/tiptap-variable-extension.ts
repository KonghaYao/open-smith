import { Node, mergeAttributes } from "@tiptap/core";
import type { Command, CommandProps } from "@tiptap/core";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        addVariable: (name: string) => ReturnType;
    }
}

export const VariableExtension = Node.create({
    name: "variable",

    group: "inline",

    inline: true,

    selectable: false,

    atom: true,

    addAttributes() {
        return {
            name: {
                default: "",
                parseHTML: (element) =>
                    element.getAttribute("data-variable-name"),
                renderHTML: (attributes) => ({
                    "data-variable-name": attributes.name,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: "span[data-variable-name]",
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "span",
            mergeAttributes(HTMLAttributes, {
                class: "bg-blue-100 text-blue-800 text-sm font-semibold mr-2 px-2.5 py-0.5 rounded-full",
            }),
            `{{${HTMLAttributes["data-variable-name"]}}}`,
        ];
    },

    renderText({ node }) {
        return `{{${node.attrs.name}}}`;
    },

    addCommands() {
        return {
            addVariable:
                (name: string): Command =>
                ({ commands }: CommandProps) => {
                    return commands.insertContent({
                        type: this.name,
                        attrs: { name },
                    });
                },
        } as any;
    },
});
