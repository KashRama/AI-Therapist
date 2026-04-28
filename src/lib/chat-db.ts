import type { SupabaseClient } from "@supabase/supabase-js";

export type DbChat = {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type DbMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export async function createChat(
  supabase: SupabaseClient,
  title = "New conversation",
  userId: string
): Promise<DbChat> {
  const { data, error } = await supabase
    .from("chats")
    .insert({ title, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChats(
  supabase: SupabaseClient,
  userId: string
): Promise<DbChat[]> {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getChat(
  supabase: SupabaseClient,
  chatId: string
): Promise<DbChat | null> {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function updateChatTitle(
  supabase: SupabaseClient,
  chatId: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from("chats")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", chatId);

  if (error) throw error;
}

export async function getMessages(
  supabase: SupabaseClient,
  chatId: string
): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function saveMessage(
  supabase: SupabaseClient,
  chatId: string,
  role: "user" | "assistant",
  content: string
): Promise<DbMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ chat_id: chatId, role, content })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId);

  return data;
}

export async function ensureChatExists(
  supabase: SupabaseClient,
  chatId: string,
  initialTitle = "New conversation",
  userId?: string
): Promise<DbChat> {
  const existing = await getChat(supabase, chatId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("chats")
    .insert({ id: chatId, title: initialTitle, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}
