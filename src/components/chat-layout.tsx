"use client";

import { useState, useCallback, useEffect } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatWindow } from "@/components/chat-window";
import type { ChatSession } from "@/types/chat";

export function ChatLayout() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setSessions(
          data.map(
            (c: {
              id: string;
              title: string;
              created_at: string;
              updated_at: string;
            }) => ({
              id: c.id,
              title: c.title,
              createdAt: new Date(c.created_at),
              updatedAt: new Date(c.updated_at),
            })
          )
        );
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    const onFocus = () => fetchChats();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchChats]);

  const handleNewChat = useCallback(async () => {
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New conversation" }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const chat = await res.json();
      const newSession: ChatSession = {
        id: chat.id,
        title: chat.title,
        createdAt: new Date(chat.created_at),
        updatedAt: new Date(chat.updated_at),
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  return (
    <SidebarProvider>
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        isLoading={isLoading}
      />
      <SidebarInset className="overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium">
            {activeSessionId
              ? sessions.find((s) => s.id === activeSessionId)?.title ??
                "Chat"
              : "AI Therapist"}
          </span>
        </header>
        <ChatWindow sessionId={activeSessionId} />
        <footer className="shrink-0 border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
          This is an AI project for informational purposes and is not a substitute
          for professional medical advice, diagnosis, or treatment.
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
