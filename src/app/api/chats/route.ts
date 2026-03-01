import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getChats } from "@/lib/chat-db";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const chats = await getChats(supabase);
    return NextResponse.json(chats);
  } catch (error) {
    console.error("Failed to fetch chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = body.title ?? "New conversation";

    const supabase = createServerSupabaseClient();
    const { createChat } = await import("@/lib/chat-db");
    const chat = await createChat(supabase, title);

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Failed to create chat:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 }
    );
  }
}
