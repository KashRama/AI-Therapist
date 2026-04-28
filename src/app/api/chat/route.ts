import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  ensureChatExists,
  saveMessage,
  updateChatTitle,
} from "@/lib/chat-db";
import { getRelevantContext } from "@/lib/rag";

const BASE_SYSTEM_PROMPT = `You are a warm, empathetic AI therapist. Your role is to provide emotional support and guidance in a safe, non-judgmental space.

Guidelines for your responses:
- Listen actively and validate the user's feelings before offering insights
- Use reflective listening—paraphrase what you hear to show understanding
- Ask open-ended questions to help users explore their thoughts and feelings
- Speak in a calm, gentle, and reassuring tone
- Avoid giving direct advice unless asked; instead, help users discover their own insights
- Be mindful of crisis situations—if someone mentions self-harm or danger, encourage them to seek immediate professional help

Remember: You are a supportive companion, not a replacement for licensed mental health professionals. When appropriate, suggest professional resources when users need specialized care.`;

function buildSystemPrompt(ragContext: string): string {
  if (!ragContext) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}

---
RELEVANT KNOWLEDGE BASE CONTEXT:
The following excerpts from therapeutic resources may be relevant to this conversation. Draw on them naturally — do not quote them directly or mention their existence to the user.

${ragContext}
---`;
}

export const maxDuration = 30;

function getTextFromMessage(message: UIMessage): string {
  return (
    message.parts
      ?.filter(
        (part): part is { type: "text"; text: string } => part.type === "text"
      )
      .map((p) => p.text)
      .join("") ?? ""
  );
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { messages, id: chatId } = body as {
    messages: UIMessage[];
    id?: string;
  };

  if (!messages?.length) {
    return new Response("Missing messages", { status: 400 });
  }

  const effectiveChatId = chatId ?? crypto.randomUUID();

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUserMessage ? getTextFromMessage(lastUserMessage) : "";

  if (userText) {
    try {
      await ensureChatExists(supabase, effectiveChatId, "New conversation", user.id);
      await saveMessage(supabase, effectiveChatId, "user", userText);

      const chats = await supabase
        .from("chats")
        .select("title")
        .eq("id", effectiveChatId)
        .single();
      const currentTitle = chats.data?.title ?? "";
      if (currentTitle === "New conversation" || currentTitle === "New Chat") {
        const title =
          userText.length > 50 ? `${userText.slice(0, 50)}...` : userText;
        await updateChatTitle(supabase, effectiveChatId, title);
      }
    } catch (err) {
      console.error("Failed to save user message:", err);
    }
  }

  const ragContext = await getRelevantContext(userText);

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: buildSystemPrompt(ragContext),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ responseMessage }) => {
      if (!responseMessage) return;
      const assistantText = getTextFromMessage(responseMessage as UIMessage);
      if (!assistantText) return;
      try {
        await saveMessage(supabase, effectiveChatId, "assistant", assistantText);
      } catch (err) {
        console.error("Failed to save assistant message:", err);
      }
    },
  });
}
