import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createEditorExtensions } from "./extensions";
import { promptForLink } from "./editorActions";
import type { PresenceUser } from "../../lib/types";

type TiptapEditorProps = {
  content: string;
  onContentChange: (value: string) => void;
  onEditorChange: (editor: Editor | null) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string }) => void;
  editable?: boolean;
  remotePresences?: PresenceUser[];
};

type RemoteSelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
};

type RemoteCursorMarker = {
  userId: string;
  left: number;
  top: number;
  height: number;
  color: string;
  label: string;
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
  editable = true,
  remotePresences = []
}: TiptapEditorProps) {
  const extensions = useMemo(() => createEditorExtensions(), []);
  const [remoteSelectionRects, setRemoteSelectionRects] = useState<RemoteSelectionRect[]>([]);
  const [remoteCursorMarkers, setRemoteCursorMarkers] = useState<RemoteCursorMarker[]>([]);
  const editor = useEditor({
    extensions,
    content: toEditorHtml(content),
    autofocus: false,
    immediatelyRender: false,
    editable,
    editorProps: {
      attributes: {
        class: "editor-prose",
        "aria-label": "Document editor",
        "data-testid": "document-editor"
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
      const { from, to } = editor.state.selection;
      editor.commands.setContent(nextContent, { emitUpdate: false });
      const nextDocSize = Math.max(1, editor.state.doc.content.size);
      const nextFrom = Math.max(1, Math.min(from, nextDocSize));
      const nextTo = Math.max(nextFrom, Math.min(to, nextDocSize));
      editor.commands.setTextSelection({ from: nextFrom, to: nextTo });
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor) {
      setRemoteSelectionRects([]);
      setRemoteCursorMarkers([]);
      return;
    }

    const updateRemoteDecorations = () => {
      const view = editor.view;
      const editorRect = view.dom.getBoundingClientRect();
      const maxPos = Math.max(1, view.state.doc.content.size);
      const nextRects: RemoteSelectionRect[] = [];
      const nextCursors: RemoteCursorMarker[] = [];

      for (const presence of remotePresences) {
        const startPos = clampPosition(presence.selection?.from ?? presence.cursorPos ?? 1, maxPos);
        const endPos = clampPosition(presence.selection?.to ?? presence.cursorPos ?? startPos, maxPos);
        const cursorPos = clampPosition(presence.cursorPos ?? endPos, maxPos);

        if (presence.selection && presence.selection.from !== presence.selection.to) {
          const range = document.createRange();
          const start = view.domAtPos(startPos);
          const end = view.domAtPos(endPos);
          range.setStart(start.node, start.offset);
          range.setEnd(end.node, end.offset);

          for (const rect of Array.from(range.getClientRects())) {
            if (!rect.width && !rect.height) {
              continue;
            }

            nextRects.push({
              left: rect.left - editorRect.left,
              top: rect.top - editorRect.top,
              width: rect.width,
              height: rect.height,
              color: presence.color
            });
          }
        }

        const coords = view.coordsAtPos(cursorPos);
        nextCursors.push({
          userId: presence.userId,
          left: coords.left - editorRect.left,
          top: coords.top - editorRect.top,
          height: Math.max(coords.bottom - coords.top, 20),
          color: presence.color,
          label: presence.displayName
        });
      }

      setRemoteSelectionRects(nextRects);
      setRemoteCursorMarkers(nextCursors);
    };

    updateRemoteDecorations();
    window.addEventListener("resize", updateRemoteDecorations);
    window.addEventListener("scroll", updateRemoteDecorations, true);
    editor.on("selectionUpdate", updateRemoteDecorations);
    editor.on("update", updateRemoteDecorations);

    return () => {
      window.removeEventListener("resize", updateRemoteDecorations);
      window.removeEventListener("scroll", updateRemoteDecorations, true);
      editor.off("selectionUpdate", updateRemoteDecorations);
      editor.off("update", updateRemoteDecorations);
    };
  }, [editor, remotePresences]);

  return (
    <div className="relative">
      {editor ? <InlineBubbleMenu editor={editor} /> : null}
      {editor ? <SlashCommandMenu editor={editor} /> : null}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
        {remoteSelectionRects.map((rect, index) => (
          <span
            key={`${rect.color}-${rect.left}-${rect.top}-${index}`}
            className="remote-selection-rect"
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              backgroundColor: `${rect.color}33`
            }}
          />
        ))}
        {remoteCursorMarkers.map((marker) => (
          <span
            key={marker.userId}
            className="remote-cursor-marker"
            style={{
              left: `${marker.left}px`,
              top: `${marker.top}px`,
              height: `${marker.height}px`,
              "--remote-cursor-color": marker.color
            } as CSSProperties}
          >
            <span className="remote-cursor-label">{marker.label}</span>
          </span>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function clampPosition(value: number, maxPos: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(Math.trunc(value), maxPos));
}

function InlineBubbleMenu({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      className="editor-bubble-menu"
      options={{ placement: "top" }}
      shouldShow={(props) => !props.editor.state.selection.empty}
    >
      <button
        className="editor-toolbar-button"
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
        data-active={editor.isActive("bold")}
      >
        B
      </button>
      <button
        className="editor-toolbar-button"
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
        data-active={editor.isActive("italic")}
      >
        I
      </button>
      <button
        className="editor-toolbar-button"
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
        data-active={editor.isActive("underline")}
      >
        U
      </button>
      <button
        className="editor-toolbar-button"
        type="button"
        onClick={() => promptForLink(editor)}
        title="Link"
        data-active={editor.isActive("link")}
      >
        Link
      </button>
      {editor.isActive("link") ? (
        <button
          className="editor-toolbar-button"
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
