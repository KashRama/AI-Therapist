"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { MessageSquareIcon, SendIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { createClientSupabaseClient } from "@/lib/supabase-client";

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

// Inner component — only mounts once messages are loaded, so useChat
// always initializes with the correct initial state for this session.
function ChatInterface({
  sessionId,
  initialMessages,
}: {
  sessionId: string;
  initialMessages: UIMessage[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, stop, error } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

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

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-6">
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
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{textContent}</p>
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                        li: ({ children }) => <li>{children}</li>,
                        h1: ({ children }) => <h1 className="mb-2 text-lg font-bold">{children}</h1>,
                        h2: ({ children }) => <h2 className="mb-2 text-base font-bold">{children}</h2>,
                        h3: ({ children }) => <h3 className="mb-1 font-semibold">{children}</h3>,
                        code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 text-sm font-mono">{children}</code>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground">{children}</blockquote>,
                      }}
                    >
                      {textContent}
                    </ReactMarkdown>
                  )}
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
      </div>

      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-2 py-2">
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
              className="min-h-1 max-h-64 resize-none border-0 bg-transparent px-4 py-2 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="flex items-center pr-2">
              {isLoading ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={stop}
                  className="size-7 shrink-0 rounded-lg"
                >
                  <span className="sr-only">Stop</span>
                  <div className="size-2 rounded-full bg-destructive" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim()}
                  className="size-7 shrink-0 rounded-lg"
                >
                  <span className="sr-only">Send</span>
                  <SendIcon className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Outer component — handles fetching and loading state, then hands off
// to ChatInterface only when messages are ready.
export function ChatWindow({ sessionId }: ChatWindowProps) {
  const [loadedSession, setLoadedSession] = useState<{
    id: string;
    messages: UIMessage[];
  } | null>(null);
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    const supabase = createClientSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const full = session?.user?.user_metadata?.full_name ?? session?.user?.user_metadata?.name ?? "";
      setFirstName(full.split(" ")[0] ?? "");
    });
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setLoadedSession(null);
      return;
    }
    setLoadedSession(null);
    fetch(`/api/chats/${sessionId}/messages`)
      .then((res) => res.json())
      .then((data: { id: string; role: string; content: string }[]) => {
        setLoadedSession({ id: sessionId, messages: data.map(dbMessageToUIMessage) });
      })
      .catch(() => {
        setLoadedSession({ id: sessionId, messages: [] });
      });
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-6 rounded-full bg-primary/10 p-6">
          <MessageSquareIcon className="size-12 text-primary" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
          Welcome to your AI Therapist{firstName ? `, ${firstName}` : ""}!
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

  if (!loadedSession) {
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
    <ChatInterface
      key={loadedSession.id}
      sessionId={loadedSession.id}
      initialMessages={loadedSession.messages}
    />
  );
}
