import { createClient } from "@supabase/supabase-js"

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
if (!configuredUrl || !configuredAnonKey) {
  throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the active Supabase project's URL and anon/public key.")
}

export const supabase = createClient(
  configuredUrl,
  configuredAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
