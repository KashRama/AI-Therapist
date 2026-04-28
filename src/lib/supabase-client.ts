import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client — used in Client Components for auth actions.
export function createClientSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
