import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Google OAuth redirects here after the user authenticates.
// Supabase exchanges the code for a session and sets the auth cookies.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/`);
}
