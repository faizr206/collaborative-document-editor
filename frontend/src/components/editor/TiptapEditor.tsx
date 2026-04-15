import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import { useEffect, useMemo } from "react";
import { createEditorExtensions } from "./extensions";
import { promptForLink } from "./editorActions";

type TiptapEditorProps = {
  content: string;
  onContentChange: (value: string) => void;
  onEditorChange: (editor: Editor | null) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string }) => void;
  editable?: boolean;
};

type SlashCommand = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  run: (editor: Editor, range: { from: number; to: number }) => void;
};

const slashCommands: SlashCommand[] = [
  {
    id: "heading-1",
    label: "Heading 1",
    description: "Large section heading",
    keywords: ["h1", "title"],
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    }
  },
  {
    id: "heading-2",
    label: "Heading 2",
    description: "Medium section heading",
    keywords: ["h2", "section"],
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    }
  },
  {
    id: "bullet-list",
    label: "Bullet list",
    description: "Start a bulleted list",
    keywords: ["list", "bullets"],
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    }
  },
  {
    id: "ordered-list",
    label: "Numbered list",
    description: "Start a numbered list",
    keywords: ["list", "ordered", "numbers"],
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    }
  },
  {
    id: "blockquote",
    label: "Quote",
    description: "Insert a block quote",
    keywords: ["quote", "blockquote"],
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    }
  },
  {
    id: "code-block",
    label: "Code block",
    description: "Insert a fenced code block",
    keywords: ["code", "snippet"],
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    }
  },
  {
    id: "divider",
    label: "Divider",
    description: "Insert a horizontal rule",
    keywords: ["divider", "rule", "line"],
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    }
  }
];

export function TiptapEditor({
  content,
  onContentChange,
  onEditorChange,
  onSelectionChange,
  editable = true
}: TiptapEditorProps) {
  const extensions = useMemo(() => createEditorExtensions(), []);
  const editor = useEditor({
    extensions,
    content: toEditorHtml(content),
    autofocus: false,
    immediatelyRender: false,
    editable,
    editorProps: {
      attributes: {
        class: "editor-content-area"
      }
    },
    onUpdate: ({ editor: nextEditor }) => {
      onContentChange(nextEditor.getHTML());
    },
    onSelectionUpdate: ({ editor: nextEditor }) => {
      const { from, to } = nextEditor.state.selection;
      onSelectionChange?.({
        from,
        to,
        text: nextEditor.state.doc.textBetween(from, to, " ")
      });
    }
  });

  useEffect(() => {
    onEditorChange(editor);

    return () => {
      onEditorChange(null);
    };
  }, [editor, onEditorChange]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextContent = toEditorHtml(content);
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [content, editor]);

  return (
    <div className="editor-sheet">
      {editor ? <InlineBubbleMenu editor={editor} /> : null}
      {editor ? <SlashCommandMenu editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function InlineBubbleMenu({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      className="bubble-menu"
      options={{ placement: "top" }}
      shouldShow={(props) => !props.editor.state.selection.empty}
    >
      <button
        className={`toolbar-button${editor.isActive("bold") ? " is-active" : ""}`}
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        B
      </button>
      <button
        className={`toolbar-button${editor.isActive("italic") ? " is-active" : ""}`}
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        I
      </button>
      <button
        className={`toolbar-button${editor.isActive("underline") ? " is-active" : ""}`}
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        U
      </button>
      <button
        className={`toolbar-button${editor.isActive("link") ? " is-active" : ""}`}
        type="button"
        onClick={() => promptForLink(editor)}
        title="Link"
      >
        Link
      </button>
      {editor.isActive("link") ? (
        <button
          className="toolbar-button"
          type="button"
          onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
          title="Remove link"
        >
          Unlink
        </button>
      ) : null}
    </BubbleMenu>
  );
}

function SlashCommandMenu({ editor }: { editor: Editor }) {
  const slashState = getSlashState(editor);
  const commands = slashState ? filterCommands(slashState.query) : [];

  return (
    <FloatingMenu
      editor={editor}
      className="slash-menu"
      options={{ placement: "bottom-start", offset: 10 }}
      shouldShow={(props) => Boolean(getSlashState(props.editor))}
    >
      <div className="slash-menu-list">
        {commands.map((command) => (
          <button
            key={command.id}
            className="slash-command"
            type="button"
            onClick={() => {
              const nextSlashState = getSlashState(editor);
              if (!nextSlashState) {
                return;
              }

              command.run(editor, nextSlashState.range);
            }}
          >
            <span className="slash-command-label">{command.label}</span>
            <span className="slash-command-description">{command.description}</span>
          </button>
        ))}
      </div>
    </FloatingMenu>
  );
}

function filterCommands(query: string) {
  const normalizedQuery = query.toLowerCase();
  if (!normalizedQuery) {
    return slashCommands;
  }

  return slashCommands.filter((command) => {
    return (
      command.label.toLowerCase().includes(normalizedQuery) ||
      command.keywords.some((keyword) => keyword.includes(normalizedQuery))
    );
  });
}

function getSlashState(editor: Editor) {
  const { selection } = editor.state;
  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
  const match = /^\/([\w- ]*)$/.exec(textBefore);

  if (!match) {
    return null;
  }

  return {
    query: match[1].trim(),
    range: {
      from: selection.from - textBefore.length,
      to: selection.from
    }
  };
}

function toEditorHtml(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    return "<p></p>";
  }

  return /<\/?[a-z][\s\S]*>/i.test(trimmed) ? content : `<p>${escapeHtml(content)}</p>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
