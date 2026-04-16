import { useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export default function YjsDemo() {
  const [content, setContent] = useState("");

  useEffect(() => {
    const ydoc = new Y.Doc();

    const provider = new WebsocketProvider(
      "wss://demos.yjs.dev",
      "my-bonus-room",
      ydoc
    );

    const yText = ydoc.getText("shared-text");

    const update = () => {
      setContent(yText.toString());
    };

    yText.observe(update);

    return () => {
      yText.unobserve(update);
      provider.destroy();
      ydoc.destroy();
    };
  }, []);

  const handleChange = (e: any) => {
    const value = e.target.value;

    const ydoc = new Y.Doc();
    const yText = ydoc.getText("shared-text");

    yText.delete(0, yText.length);
    yText.insert(0, value);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Yjs Bonus Demo</h2>
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
        }}
        style={{ width: "100%", height: 200 }}
      />
    </div>
  );
}