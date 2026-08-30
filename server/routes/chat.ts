import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

interface User { id: string; name: string; email: string; passwordHash: string; color: string; }
interface Message { id: string; conversationId: string; senderId: string; text: string; createdAt: string; }

const users = new Map<string, User>();
const sessions = new Map<string, string>();
const conversations = new Map<string, Set<string>>();
const messages: Message[] = [];
const colors = ["#7c5cff", "#e66c91", "#ed9b4d", "#38a987", "#4d91d9"];

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) { return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`; }
function validPassword(password: string, stored: string) { const [salt, hash] = stored.split(":"); return Boolean(salt && hash) && timingSafeEqual(Buffer.from(hash, "hex"), scryptSync(password, salt, 32)); }
function getSession(req: Parameters<RequestHandler>[0]) { const token = req.headers.cookie?.match(/chat_session=([^;]+)/)?.[1]; return token ? sessions.get(token) : undefined; }
function requireUser(req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) { const id = getSession(req); const user = id ? users.get(id) : undefined; if (!user) { res.status(401).json({ error: "Please log in" }); return null; } return user; }
function publicUser(user: User) { return { id: user.id, name: user.name, email: user.email, color: user.color }; }
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }

export const signup: RequestHandler = (req, res) => {
  const name = String(req.body.name || "").trim(); const email = String(req.body.email || "").trim().toLowerCase(); const password = String(req.body.password || "");
  if (name.length < 2 || !email.includes("@") || password.length < 6) return res.status(400).json({ error: "Use a name, valid email, and password of at least 6 characters" });
  if ([...users.values()].some((user) => user.email === email)) return res.status(409).json({ error: "An account with that email already exists" });
  const user: User = { id: randomBytes(12).toString("hex"), name, email, passwordHash: hashPassword(password), color: colors[users.size % colors.length] };
  users.set(user.id, user); const token = randomBytes(32).toString("hex"); sessions.set(token, user.id); res.setHeader("Set-Cookie", `chat_session=${token}; HttpOnly; SameSite=Lax; Max-Age=2592000; Path=/`);
  res.status(201).json({ user: publicUser(user) });
};

export const login: RequestHandler = (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase(); const password = String(req.body.password || ""); const user = [...users.values()].find((candidate) => candidate.email === email);
  if (!user || !validPassword(password, user.passwordHash)) return res.status(401).json({ error: "Incorrect email or password" });
  const token = randomBytes(32).toString("hex"); sessions.set(token, user.id); res.setHeader("Set-Cookie", `chat_session=${token}; HttpOnly; SameSite=Lax; Max-Age=2592000; Path=/`); res.json({ user: publicUser(user) });
};

export const logout: RequestHandler = (req, res) => { const token = req.headers.cookie?.match(/chat_session=([^;]+)/)?.[1]; if (token) sessions.delete(token); res.setHeader("Set-Cookie", "chat_session=; Max-Age=0; Path=/"); res.status(204).end(); };
export const me: RequestHandler = (req, res) => { const user = requireUser(req, res); if (user) res.json({ user: publicUser(user) }); };

export const findUsers: RequestHandler = (req, res) => {
  const current = requireUser(req, res); if (!current) return; const search = String(req.query.search || "").toLowerCase();
  res.json({ users: [...users.values()].filter((user) => user.id !== current.id && (!search || user.name.toLowerCase().includes(search) || user.email.includes(search))).map(publicUser) });
};

export const listConversations: RequestHandler = (req, res) => {
  const current = requireUser(req, res); if (!current) return;
  const result = [...conversations.entries()].filter(([, members]) => members.has(current.id)).map(([id, members]) => { const other = [...members].find((member) => member !== current.id); const user = other ? users.get(other) : undefined; const latest = [...messages].reverse().find((message) => message.conversationId === id); return user ? { id, user: { ...publicUser(user), initials: initials(user.name), online: true }, preview: latest?.text || "New conversation", lastMessageAt: latest?.createdAt || "" } : null; }).filter(Boolean);
  res.json({ conversations: result });
};

export const createConversation: RequestHandler = (req, res) => {
  const current = requireUser(req, res); if (!current) return; const other = users.get(String(req.body.userId || "")); if (!other || other.id === current.id) return res.status(400).json({ error: "Choose another registered user" });
  const existing = [...conversations.entries()].find(([, members]) => members.size === 2 && members.has(current.id) && members.has(other.id));
  if (existing) return res.json({ id: existing[0] });
  const id = randomBytes(12).toString("hex"); conversations.set(id, new Set([current.id, other.id])); res.status(201).json({ id });
};

export const getMessages: RequestHandler = (req, res) => { const current = requireUser(req, res); if (!current) return; const members = conversations.get(String(req.params.id)); if (!members?.has(current.id)) return res.status(404).json({ error: "Conversation not found" }); res.json({ messages: messages.filter((message) => message.conversationId === req.params.id) }); };
export const sendMessage: RequestHandler = (req, res) => { const current = requireUser(req, res); if (!current) return; const conversationId = String(req.params.id); const members = conversations.get(conversationId); const text = String(req.body.text || "").trim(); if (!members?.has(current.id)) return res.status(404).json({ error: "Conversation not found" }); if (!text || text.length > 4000) return res.status(400).json({ error: "Message must be between 1 and 4000 characters" }); const message: Message = { id: randomBytes(12).toString("hex"), conversationId, senderId: current.id, text, createdAt: new Date().toISOString() }; messages.push(message); res.status(201).json({ message }); };
