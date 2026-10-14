import { createClient } from "@supabase/supabase-js"
import { projectId, publicAnonKey } from "../../../utils/supabase/info"

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
export const supabaseUrl = configuredUrl || `https://${projectId}.supabase.co`
export const supabaseAnonKey = configuredAnonKey || publicAnonKey

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
