"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { MessageSquareIcon, SendIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  sessionId: string | null;
}

function dbMessageToUIMessage(m: {
  id: string;
  role: string;
  content: string;
}): UIMessage {
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text", text: m.content }],
  };
}

export function ChatWindow({ sessionId }: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(
    null
  );

  useEffect(() => {
    if (!sessionId) {
      setInitialMessages(null);
      return;
    }
    setInitialMessages(null);
    fetch(`/api/chats/${sessionId}/messages`)
      .then((res) => res.json())
      .then((data: { id: string; role: string; content: string }[]) => {
        setInitialMessages(data.map(dbMessageToUIMessage));
      })
      .catch(() => setInitialMessages([]));
  }, [sessionId]);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: sessionId ?? undefined,
    messages: initialMessages ?? undefined,
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  if (!sessionId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-6 rounded-full bg-primary/10 p-6">
          <MessageSquareIcon className="size-12 text-primary" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
          Welcome to AI Therapist
        </h2>
        <p className="mb-8 max-w-md text-muted-foreground">
          Start a new conversation to begin. Share what&apos;s on your mind, and
          I&apos;ll be here to listen and support you.
        </p>
        <p className="text-sm text-muted-foreground">
          Click &quot;New Chat&quot; in the sidebar to get started
        </p>
      </div>
    );
  }

  if (initialMessages === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" />
          <span>Loading conversation...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full min-h-0">
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-8 pb-4">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error.message}
            </div>
          )}
          {messages.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-primary/5 p-4">
                <MessageSquareIcon className="size-8 text-primary/70" />
              </div>
              <p className="text-sm text-muted-foreground">
                Share what&apos;s on your mind. I&apos;m here to listen.
              </p>
            </div>
          )}
          {messages.map((message) => {
            const isUser = message.role === "user";
            const textContent =
              message.parts
                ?.filter(
                  (part): part is { type: "text"; text: string } =>
                    part.type === "text"
                )
                .map((p) => p.text)
                .join("") ?? "";

            if (!textContent) return null;

            return (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 animate-in fade-in-50 duration-300",
                  isUser ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-[1.6] shadow-sm",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground border border-border/50"
                  )}
                >
                  <p className="whitespace-pre-wrap">{textContent}</p>
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex gap-3">
              <div className="max-w-[85%] rounded-2xl bg-muted/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Thinking...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-2xl px-4 py-4"
        >
          <div className="relative flex gap-2 rounded-xl border border-border bg-muted/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Share what's on your mind..."
              disabled={isLoading}
              rows={1}
              className="min-h-12 max-h-32 resize-none border-0 bg-transparent px-4 py-3 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="flex items-end gap-1 p-2">
              {isLoading ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={stop}
                  className="size-9 shrink-0 rounded-lg"
                >
                  <span className="sr-only">Stop</span>
                  <div className="size-2 rounded-full bg-destructive" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim()}
                  className="size-9 shrink-0 rounded-lg"
                >
                  <span className="sr-only">Send</span>
                  <SendIcon className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}
