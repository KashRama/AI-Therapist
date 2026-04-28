import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Auth-aware server client — reads the user's session from cookies.
// Use this in API routes and Server Components.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies can't be set
            // here but the middleware will handle refreshing the session.
          }
        },
      },
    }
  );
}
