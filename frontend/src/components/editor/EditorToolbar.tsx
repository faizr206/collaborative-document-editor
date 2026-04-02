import type { Editor } from "@tiptap/react";
import { promptForLink } from "./editorActions";

type EditorToolbarProps = {
  editor: Editor | null;
};

const textColors = ["#111827", "#2563eb", "#0f766e", "#b45309", "#b91c1c"];

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const textColor = (editor?.getAttributes("textStyle").color as string | undefined) ?? "#111827";

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Formatting toolbar">
      <div className="toolbar-group">
        <ToolbarButton
          editor={editor}
          label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor || !editor.can().chain().focus().undo().run()}
        />
        <ToolbarButton
          editor={editor}
          label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor || !editor.can().chain().focus().redo().run()}
        />
      </div>

      <div className="toolbar-group">
        <label className="toolbar-select-label">
          <span className="sr-only">Text style</span>
          <select
            className="toolbar-select"
            value={getBlockType(editor)}
            onChange={(event) => applyBlockType(editor, event.target.value)}
            disabled={!editor}
            aria-label="Paragraph style"
          >
            <option value="paragraph">Paragraph</option>
            <option value="heading-1">Heading 1</option>
            <option value="heading-2">Heading 2</option>
            <option value="heading-3">Heading 3</option>
            <option value="codeBlock">Code block</option>
          </select>
        </label>
      </div>

      <div className="toolbar-group">
        <ToolbarButton
          editor={editor}
          label="B"
          title="Bold (Ctrl/Cmd+B)"
          isActive={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor || !editor.can().chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          editor={editor}
          label="I"
          title="Italic (Ctrl/Cmd+I)"
          isActive={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={!editor || !editor.can().chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          editor={editor}
          label="U"
          title="Underline (Ctrl/Cmd+U)"
          isActive={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          disabled={!editor || !editor.can().chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          editor={editor}
          label="S"
          title="Strike"
          isActive={editor?.isActive("strike")}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          disabled={!editor || !editor.can().chain().focus().toggleStrike().run()}
        />
      </div>

      <div className="toolbar-group">
        <label className="color-control" title="Text color">
          <span className="sr-only">Text color</span>
          <input
            type="color"
            value={normalizeColor(textColor)}
            onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
            disabled={!editor}
            aria-label="Text color"
          />
        </label>
      </div>

      <div className="toolbar-group">
        <ToolbarButton
          editor={editor}
          label="• List"
          title="Bullet list"
          isActive={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          disabled={!editor || !editor.can().chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          editor={editor}
          label="1. List"
          title="Numbered list"
          isActive={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          disabled={!editor || !editor.can().chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          editor={editor}
          label="Quote"
          title="Block quote"
          isActive={editor?.isActive("blockquote")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          disabled={!editor || !editor.can().chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          editor={editor}
          label="Code"
          title="Inline code"
          isActive={editor?.isActive("code")}
          onClick={() => editor?.chain().focus().toggleCode().run()}
          disabled={!editor || !editor.can().chain().focus().toggleCode().run()}
        />
        <ToolbarButton
          editor={editor}
          label="Divider"
          title="Insert divider"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={!editor || !editor.can().chain().focus().setHorizontalRule().run()}
        />
      </div>

      <div className="toolbar-group">
        <ToolbarButton
          editor={editor}
          label="Link"
          title="Insert link"
          isActive={editor?.isActive("link")}
          onClick={() => {
            if (editor) {
              promptForLink(editor);
            }
          }}
          disabled={!editor}
        />
        <ToolbarButton
          editor={editor}
          label="Clear"
          title="Clear formatting"
          onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
          disabled={!editor}
        />
      </div>
    </div>
  );
}

type ToolbarButtonProps = {
  editor: Editor | null;
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
  isActive?: boolean;
};

function ToolbarButton({ label, title, onClick, disabled, isActive }: ToolbarButtonProps) {
  return (
    <button
      className={`toolbar-button${isActive ? " is-active" : ""}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}

function getBlockType(editor: Editor | null) {
  if (!editor) {
    return "paragraph";
  }

  if (editor.isActive("codeBlock")) {
    return "codeBlock";
  }

  if (editor.isActive("heading", { level: 1 })) {
    return "heading-1";
  }

  if (editor.isActive("heading", { level: 2 })) {
    return "heading-2";
  }

  if (editor.isActive("heading", { level: 3 })) {
    return "heading-3";
  }

  return "paragraph";
}

function applyBlockType(editor: Editor | null, value: string) {
  if (!editor) {
    return;
  }

  if (value === "paragraph") {
    editor.chain().focus().setParagraph().run();
    return;
  }

  if (value === "codeBlock") {
    editor.chain().focus().toggleCodeBlock().run();
    return;
  }

  if (value === "heading-1") {
    editor.chain().focus().toggleHeading({ level: 1 }).run();
    return;
  }

  if (value === "heading-2") {
    editor.chain().focus().toggleHeading({ level: 2 }).run();
    return;
  }

  if (value === "heading-3") {
    editor.chain().focus().toggleHeading({ level: 3 }).run();
  }
}

function normalizeColor(color: string) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  return "#111827";
}
