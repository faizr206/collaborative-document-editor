import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

export function createEditorExtensions() {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      }
    }),
    TextStyle,
    Color.configure({
      types: ["textStyle"]
    }),
    Underline,
    Link.configure({
      autolink: true,
      defaultProtocol: "https",
      openOnClick: false
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === "heading") {
          return "Give this section a heading";
        }

        return "Start writing, or type / for commands";
      }
    })
  ];
}
