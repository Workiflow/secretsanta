import { redirect } from "next/navigation"
import type { Supabase } from "@/lib/supabase/server"

export async function getUser(supabase: Supabase) {
  const { data } = await supabase.auth.getUser()
  return data.user
}

export async function requireUser(supabase: Supabase, next = "/dashboard") {
  const user = await getUser(supabase)
  if (!user) redirect(`/?next=${encodeURIComponent(next)}`)
  return user
}

export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
}
