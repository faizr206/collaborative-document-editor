import { useEffect, useRef, useState } from "react";

function App() {
  const [status, setStatus] = useState("Connecting...");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://127.0.0.1:8000/ws");
    socketRef.current = socket;

    socket.onopen = () => setStatus("Connected");
    socket.onmessage = (event) => setMessages((prev) => [...prev, event.data]);
    socket.onclose = () => setStatus("Disconnected");
    socket.onerror = () => setStatus("Error");

    return () => socket.close();
  }, []);

  function sendMessage() {
    if (!message.trim()) return;
    socketRef.current?.send(message);
    setMessage("");
  }

  return (
    <div style={{ padding: "32px", fontFamily: "Arial, sans-serif" }}>
      <h1>Real-Time Collaboration Test</h1>
      <p><strong>Status:</strong> {status}</p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message"
          style={{ padding: "10px", width: "300px" }}
        />
        <button onClick={sendMessage} style={{ padding: "10px 16px" }}>
          Send
        </button>
      </div>

      <div style={{ border: "1px solid #ccc", padding: "12px", minHeight: "200px", width: "420px" }}>
        {messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          messages.map((msg, index) => <div key={index}>{msg}</div>)
        )}
      </div>
    </div>
  );
}

export default App;