import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, MoreVertical, Paperclip, Phone, Plus, Search, Send, Smile, Video } from "lucide-react";

type Message = { id: number; text: string; sender: "me" | "them"; time: string; read?: boolean };
type Conversation = { id: string; name: string; initials: string; color: string; online: boolean; preview: string; messages: Message[] };

const initialConversations: Conversation[] = [
  { id: "jordan", name: "Jordan Lee", initials: "JL", color: "#7c5cff", online: true, preview: "Sounds good — see you then!", messages: [
    { id: 1, text: "Hey! Are we still on for the project review this afternoon?", sender: "them", time: "10:24 AM" },
    { id: 2, text: "Absolutely. I’ll have the latest version ready in a few minutes.", sender: "me", time: "10:26 AM", read: true },
    { id: 3, text: "Sounds good — see you then!", sender: "them", time: "10:27 AM" },
  ] },
  { id: "morgan", name: "Morgan Chen", initials: "MC", color: "#e66c91", online: false, preview: "Thanks for sending that over.", messages: [{ id: 4, text: "Thanks for sending that over.", sender: "them", time: "Yesterday" }] },
  { id: "sam", name: "Sam Rivera", initials: "SR", color: "#ed9b4d", online: true, preview: "Can you take a look when you can?", messages: [{ id: 5, text: "Can you take a look when you can?", sender: "them", time: "Monday" }] },
];

const storageKey = "simple-chat-conversations";

export default function Index() {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "null") || initialConversations; } catch { return initialConversations; }
  });
  const [activeId, setActiveId] = useState("jordan");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Online");
  const endRef = useRef<HTMLDivElement>(null);
  const active = conversations.find((conversation) => conversation.id === activeId) || conversations[0];
  const filtered = useMemo(() => conversations.filter((conversation) => conversation.name.toLowerCase().includes(search.toLowerCase())), [conversations, search]);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(conversations)); }, [conversations]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.messages.length]);

  const sendMessage = (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || !active) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const message: Message = { id: Date.now(), text, sender: "me", time, read: true };
    setConversations((current) => current.map((conversation) => conversation.id === active.id ? { ...conversation, preview: text, messages: [...conversation.messages, message] } : conversation));
    setDraft("");
    setStatus("Message sent");
    window.setTimeout(() => setStatus("Online"), 1800);
  };

  const startConversation = () => {
    const name = window.prompt("Name of the person");
    if (!name?.trim()) return;
    const id = `person-${Date.now()}`;
    const conversation: Conversation = { id, name: name.trim(), initials: name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), color: "#38a987", online: true, preview: "New conversation", messages: [] };
    setConversations((current) => [conversation, ...current]);
    setActiveId(id);
  };

  return <div className="chat-app"><header className="chat-topbar"><div className="chat-logo"><span>◈</span> Loopchat</div><div className="chat-top-spacer" /><span className="chat-you"><i /> You are {status.toLowerCase()}</span><button className="profile-button">JS</button></header><main className="chat-shell"><aside className="chat-sidebar"><div className="sidebar-heading"><div><p>Messages</p><span>{conversations.length} conversations</span></div><button onClick={startConversation} aria-label="New conversation"><Plus size={18} /></button></div><label className="chat-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" /></label><div className="conversation-list">{filtered.map((conversation) => <button className={`conversation ${active?.id === conversation.id ? "active" : ""}`} key={conversation.id} onClick={() => setActiveId(conversation.id)}><span className="avatar" style={{ background: conversation.color }}>{conversation.initials}{conversation.online && <i />}</span><span className="conversation-copy"><strong>{conversation.name}</strong><small>{conversation.preview}</small></span><span className="conversation-time">{conversation.messages[conversation.messages.length - 1]?.time || "New"}</span></button>)}{!filtered.length && <p className="no-results">No conversations found.</p>}</div><div className="sidebar-footer"><span className="avatar small">JS</span><div><strong>Jesse</strong><small>Personal account</small></div><button aria-label="More options"><MoreVertical size={16} /></button></div></aside><section className="chat-main"><header className="conversation-header"><span className="avatar" style={{ background: active.color }}>{active.initials}{active.online && <i />}</span><div><h1>{active.name}</h1><p>{active.online ? "Active now" : "Offline"}</p></div><div className="conversation-actions"><button aria-label="Start audio call"><Phone size={18} /></button><button aria-label="Start video call"><Video size={19} /></button><button aria-label="More options"><MoreVertical size={19} /></button></div></header><div className="message-area"><div className="day-divider"><span>Today</span></div>{active.messages.map((message, index) => <div className={`message-row ${message.sender === "me" ? "mine" : "theirs"}`} key={message.id}><div className="message-bubble"><p>{message.text}</p><span>{message.time}{message.sender === "me" && <Check size={13} className={message.read ? "read" : ""} />}</span></div></div>)}{active.messages.length === 0 && <div className="empty-chat"><div>{active.initials}</div><h2>Start a conversation with {active.name}</h2><p>Send a message to begin chatting.</p></div>}<div ref={endRef} /></div><form className="composer" onSubmit={sendMessage}><button type="button" aria-label="Attach a file"><Paperclip size={19} /></button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${active.name}`} /><button type="button" aria-label="Add emoji"><Smile size={19} /></button><button className="send-button" type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={18} /></button></form></section></main></div>;
}
