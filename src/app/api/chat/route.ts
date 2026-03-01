import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  ensureChatExists,
  saveMessage,
  updateChatTitle,
} from "@/lib/chat-db";

const THERAPIST_SYSTEM_PROMPT = `You are a warm, empathetic AI therapist. Your role is to provide emotional support and guidance in a safe, non-judgmental space.

Guidelines for your responses:
- Listen actively and validate the user's feelings before offering insights
- Use reflective listening—paraphrase what you hear to show understanding
- Ask open-ended questions to help users explore their thoughts and feelings
- Speak in a calm, gentle, and reassuring tone
- Avoid giving direct advice unless asked; instead, help users discover their own insights
- Be mindful of crisis situations—if someone mentions self-harm or danger, encourage them to seek immediate professional help

Remember: You are a supportive companion, not a replacement for licensed mental health professionals. When appropriate, suggest professional resources when users need specialized care.`;

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
  const body = await req.json();
  const { messages, id: chatId } = body as {
    messages: UIMessage[];
    id?: string;
  };

  if (!messages?.length) {
    return new Response("Missing messages", { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  // Use chatId from request, or generate one for new chats
  const effectiveChatId = chatId ?? crypto.randomUUID();

  // Get the last user message (the one we're responding to)
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUserMessage ? getTextFromMessage(lastUserMessage) : "";

  if (userText) {
    try {
      await ensureChatExists(supabase, effectiveChatId);
      await saveMessage(supabase, effectiveChatId, "user", userText);

      // Update chat title from first user message if it's still default
      const chats = await supabase
        .from("chats")
        .select("title")
        .eq("id", effectiveChatId)
        .single();
      const currentTitle = chats.data?.title ?? "";
      if (
        currentTitle === "New conversation" ||
        currentTitle === "New Chat"
      ) {
        const title =
          userText.length > 50 ? `${userText.slice(0, 50)}...` : userText;
        await updateChatTitle(supabase, effectiveChatId, title);
      }
    } catch (err) {
      console.error("Failed to save user message:", err);
      // Continue streaming even if save fails
    }
  }

  const result = streamText({
    model: openai("gpt-4o"),
    system: THERAPIST_SYSTEM_PROMPT,
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
