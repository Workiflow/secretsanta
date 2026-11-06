import "server-only"
import { createClient } from "@supabase/supabase-js"

// Bypasses RLS. Only used to send draw emails and record delivery.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
