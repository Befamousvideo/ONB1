import { useState } from "react";

const defaultAccountId = "11111111-1111-1111-1111-111111111111";

export default function LocalTools() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [subject, setSubject] = useState("Local UX test");
  const [channel, setChannel] = useState("web");
  const [senderType, setSenderType] = useState("contact");
  const [body, setBody] = useState("Hello");
  const [summary, setSummary] = useState("Local end-and-send");
  const [conversationId, setConversationId] = useState<string>("");
  const [responseJson, setResponseJson] = useState<string>("{}");

  const show = async (res: Response) => {
    const text = await res.text();
    setResponseJson(text || "{}");
    try {
      const parsed = JSON.parse(text);
      if (parsed?.id) {
        setConversationId(parsed.id);
      }
    } catch {
      return;
    }
  };

  const createConversation = async () => {
    const res = await fetch(`${apiBase}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: accountId, channel, subject }),
    });
    await show(res);
  };

  const addMessage = async () => {
    if (!conversationId) return;
    const res = await fetch(`${apiBase}/api/conversations/${conversationId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_type: senderType, body }),
    });
    await show(res);
  };

  const getConversation = async () => {
    if (!conversationId) return;
    const res = await fetch(`${apiBase}/api/conversations/${conversationId}`, {
      method: "GET",
    });
    await show(res);
  };

  const endAndSend = async () => {
    if (!conversationId) return;
    const res = await fetch(`${apiBase}/api/conversations/${conversationId}/end-and-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary }),
    });
    await show(res);
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 860, margin: "32px auto", padding: "0 16px" }}>
      <h1>ONB1 Local UX</h1>
      <p>Minimal tools for local API smoke checks.</p>

      <section style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <h2>Create Conversation</h2>
        <label>Account ID</label>
        <input
          style={{ width: "100%", marginBottom: 8 }}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        />
        <label>Subject</label>
        <input
          style={{ width: "100%", marginBottom: 8 }}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <label>Channel</label>
        <input
          style={{ width: "100%", marginBottom: 8 }}
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        />
        <button onClick={createConversation}>Create</button>
      </section>

      <section style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <h2>Add Message</h2>
        <label>Sender Type</label>
        <input
          style={{ width: "100%", marginBottom: 8 }}
          value={senderType}
          onChange={(e) => setSenderType(e.target.value)}
        />
        <label>Body</label>
        <textarea
          style={{ width: "100%", marginBottom: 8 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button onClick={addMessage} disabled={!conversationId}>
          Add Message
        </button>
      </section>

      <section style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <h2>View Conversation</h2>
        <button onClick={getConversation} disabled={!conversationId}>
          Get Conversation
        </button>
      </section>

      <section style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8, marginBottom: 16 }}>
        <h2>End and Send</h2>
        <label>Summary</label>
        <textarea
          style={{ width: "100%", marginBottom: 8 }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <button onClick={endAndSend} disabled={!conversationId}>
          End and Send
        </button>
      </section>

      <section style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
        <h2>Response JSON</h2>
        <div style={{ color: "#666", marginBottom: 8 }}>Conversation ID: {conversationId || "(none)"}</div>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f7f7f7", padding: 12, borderRadius: 6 }}>
          {responseJson}
        </pre>
      </section>
    </div>
  );
}
