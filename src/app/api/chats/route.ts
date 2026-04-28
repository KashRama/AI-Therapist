import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getChats, createChat } from "@/lib/chat-db";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const chats = await getChats(supabase, user.id);
    return NextResponse.json(chats);
  } catch (error) {
    console.error("Failed to fetch chats:", error);
    return NextResponse.json({ error: "Failed to fetch chats" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = body.title ?? "New conversation";
    const chat = await createChat(supabase, title, user.id);
    return NextResponse.json(chat);
  } catch (error) {
    console.error("Failed to create chat:", error);
    return NextResponse.json({ error: "Failed to create chat" }, { status: 500 });
  }
}
