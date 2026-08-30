import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { createConversation, findUsers, getMessages, listConversations, login, logout, me, sendMessage, signup } from "./routes/chat";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.post("/api/auth/signup", signup);
  app.post("/api/auth/login", login);
  app.post("/api/auth/logout", logout);
  app.get("/api/auth/me", me);
  app.get("/api/users", findUsers);
  app.get("/api/conversations", listConversations);
  app.post("/api/conversations", createConversation);
  app.get("/api/conversations/:id/messages", getMessages);
  app.post("/api/conversations/:id/messages", sendMessage);

  return app;
}
