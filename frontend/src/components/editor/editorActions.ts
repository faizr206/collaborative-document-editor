import type { Editor } from "@tiptap/react";

export function promptForLink(editor: Editor): void {
  const currentHref = editor.getAttributes("link").href as string | undefined;
  const value = window.prompt("Enter a link URL", currentHref ?? "https://");

  if (value === null) {
    return;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}
