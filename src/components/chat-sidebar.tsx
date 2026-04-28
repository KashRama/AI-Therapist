"use client";

import { MessageSquarePlusIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatSession } from "@/types/chat";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  isLoading = false,
}: ChatSidebarProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <Sidebar side="left" collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <Button
          className="w-full justify-start gap-2"
          onClick={onNewChat}
          size="sm"
        >
          <MessageSquarePlusIcon className="size-4" />
          New Chat
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Previous Sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <SidebarMenu>
                {isLoading ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No sessions yet. Start a new chat to begin.
                  </div>
                ) : (
                  sessions.map((session) => (
                    <SidebarMenuItem key={session.id}>
                      <SidebarMenuButton
                        isActive={activeSessionId === session.id}
                        onClick={() => onSelectSession(session.id)}
                        size="lg"
                      >
                        <span className="flex flex-col gap-0.5 overflow-hidden">
                          <span className="truncate text-left">
                            {session.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(session.updatedAt)}
                          </span>
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
