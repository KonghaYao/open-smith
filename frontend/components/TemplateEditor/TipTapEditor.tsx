import { createTiptapEditor } from "solid-tiptap";
import { For, createEffect, createSignal } from "solid-js";
import { VariableExtension } from "../../utils/tiptap-variable-extension.js";
import type { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";

export const TipTapEditor = (props: {
    content: string;
    onChange: (content: string) => void;
    variables: string[];
}) => {
    const [ref, setRef] = createSignal<HTMLDivElement>();
    const editor = createTiptapEditor(() => ({
        element: ref(),
        extensions: [
            Document,
            Paragraph,
            Text,
            VariableExtension.configure({
                // Add any configuration here if needed
            }),
        ],
        editorProps: {
            attributes: {
                class: "p-8 focus:outline-none prose max-w-full",
            },
        },
        editable: true,
        content: props.content,
        onBlur: ({ editor }: { editor: Editor }) => {
            props.onChange(editor.getText({ blockSeparator: "\n" }));
        },
    }));

    const addVariable = (variableName: string) => {
        editor()?.chain().focus().addVariable(variableName).run();
    };
    createEffect(() => {
        if (editor()?.getText({ blockSeparator: "\n" }) !== props.content) {
            editor()?.commands.setContent(props.content);
        }
    });

    return (
        <div class="border border-gray-300 rounded-md">
            <div class="flex items-center gap-2 border-b border-gray-300 p-2 flex-wrap">
                <For each={props.variables}>
                    {(variable) => (
                        <button
                            onClick={() => addVariable(variable)}
                            class="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full hover:bg-blue-200"
                        >
                            {`{{${variable}}}`}
                        </button>
                    )}
                </For>
            </div>
            <div ref={setRef} class="p-2 min-h-24 focus:outline-none" />
        </div>
    );
};
