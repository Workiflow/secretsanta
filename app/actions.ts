"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireUser, safeNext } from "@/lib/auth"
import { sendDrawEmails } from "@/lib/draw-emails"
import { createClient } from "@/lib/supabase/server"

export type FormState = { error?: string; ok?: string } | null

export type SignInState = { step: "details" | "code"; email?: string; error?: string; next: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const field = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim()

function authMessage(error: { status?: number; message: string }) {
  if (error.status === 429 || /rate limit/i.test(error.message))
    return "Too many sign-in emails just now. Wait a minute, then try again."
  return "We couldn't send your code. Check the email address and try again."
}

// ---------- Sign in: email a one-time code, then verify it ----------

export async function signIn(prev: SignInState, fd: FormData): Promise<SignInState> {
  const supabase = await createClient()
  const next = safeNext(field(fd, "next"))
  const intent = field(fd, "intent")

  if (intent === "back") return { step: "details", next }

  if (prev.step === "details" || intent === "resend") {
    const email = (field(fd, "email") || prev.email || "").toLowerCase()
    const name = field(fd, "name")
    if (prev.step === "details" && !name) return { step: "details", next, email, error: "Add your name so your family knows who you are." }
    if (!EMAIL_RE.test(email)) return { step: "details", next, error: "That email doesn't look right. Check it and try again." }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, ...(name ? { data: { name: name.slice(0, 60) } } : {}) },
    })
    if (error) return { step: prev.step, next, email, error: authMessage(error) }
    return { step: "code", email, next }
  }

  const token = field(fd, "code").replace(/\s/g, "")
  if (!prev.email || !/^\d{6,10}$/.test(token)) return { ...prev, error: "Enter the code from the email." }

  const { error } = await supabase.auth.verifyOtp({ email: prev.email, token, type: "email" })
  if (error) return { ...prev, error: "That code didn't work or has expired. Check the latest email, or send a new code." }
  redirect(next)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

export async function updateName(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient()
  const user = await requireUser(supabase)
  const name = field(fd, "name").slice(0, 60)
  if (!name) return { error: "Your name can't be empty." }
  const { error } = await supabase.from("profiles").update({ name }).eq("id", user.id)
  if (error) return { error: "Couldn't save your name. Try again." }
  revalidatePath("/", "layout")
  return { ok: "Saved." }
}

// ---------- Parties ----------

export async function createParty(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient()
  await requireUser(supabase)
  const name = field(fd, "name").slice(0, 80)
  if (!name) return { error: "Give your party a name." }

  const { data, error } = await supabase
    .from("parties")
    .insert({ name, exchange_date: field(fd, "exchange_date") || null, budget: field(fd, "budget").slice(0, 40) || null })
    .select("id")
    .single()
  if (error) return { error: "Couldn't create the party. Try again." }
  redirect(`/parties/${data.id}`)
}

export async function updateParty(partyId: string, _: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient()
  const user = await requireUser(supabase)
  const name = field(fd, "name").slice(0, 80)
  if (!name) return { error: "The party needs a name." }

  const { data, error } = await supabase
    .from("parties")
    .update({ name, exchange_date: field(fd, "exchange_date") || null, budget: field(fd, "budget").slice(0, 40) || null })
    .eq("id", partyId)
    .eq("host_id", user.id)
    .select("id")
  if (error || !data?.length) return { error: "Couldn't save. Only the host can change these." }
  revalidatePath(`/parties/${partyId}`)
  return { ok: "Saved." }
}

export async function deleteParty(partyId: string) {
  const supabase = await createClient()
  const user = await requireUser(supabase)
  await supabase.from("parties").delete().eq("id", partyId).eq("host_id", user.id)
  redirect("/dashboard")
}

export async function joinParty(code: string, _: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient()
  await requireUser(supabase, `/join/${code}`)
  const { data, error } = await supabase.rpc("join_party", { p_code: code, p_wishlist: field(fd, "wishlist") })
  if (error) return { error: error.message }
  redirect(`/parties/${data}`)
}

export async function goToInvite(_: FormState, fd: FormData): Promise<FormState> {
  // Accept a bare code or a pasted invite link.
  const raw = field(fd, "code")
  const code = (raw.match(/\/join\/([A-Za-z0-9]+)/)?.[1] ?? raw).replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  if (code.length < 6) return { error: "Paste the invite link or enter the code from it." }
  redirect(`/join/${code}`)
}

export async function updateWishlist(partyId: string, _: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient()
  const user = await requireUser(supabase)
  const { error } = await supabase
    .from("memberships")
    .update({ wishlist: field(fd, "wishlist").slice(0, 500) })
    .eq("party_id", partyId)
    .eq("user_id", user.id)
  if (error) return { error: "Couldn't save your gift ideas. Try again." }
  revalidatePath(`/parties/${partyId}`)
  return { ok: "Saved." }
}

export async function removeMember(partyId: string, userId: string) {
  const supabase = await createClient()
  await requireUser(supabase)
  await supabase.from("memberships").delete().eq("party_id", partyId).eq("user_id", userId)
  revalidatePath(`/parties/${partyId}`)
}

export async function leaveParty(partyId: string) {
  const supabase = await createClient()
  const user = await requireUser(supabase)
  await supabase.from("memberships").delete().eq("party_id", partyId).eq("user_id", user.id)
  redirect("/dashboard")
}

// ---------- The draw ----------

async function assertHost(partyId: string) {
  const supabase = await createClient()
  const user = await requireUser(supabase)
  const { data } = await supabase.from("parties").select("host_id").eq("id", partyId).maybeSingle()
  return { supabase, isHost: data?.host_id === user.id }
}

export async function drawNames(partyId: string, _: FormState): Promise<FormState> {
  const { supabase, isHost } = await assertHost(partyId)
  if (!isHost) return { error: "Only the host can draw names." }

  const { data: count, error } = await supabase.rpc("draw_names", { p_party: partyId })
  if (error) return { error: error.message }

  const { sent, failed } = await sendDrawEmails(partyId, { onlyUnsent: false })
  revalidatePath(`/parties/${partyId}`)
  return failed
    ? { error: `Names drawn for ${count} people. ${sent} emails sent, ${failed} failed. Everyone can still see their giftee here; use Resend below once email is fixed.` }
    : { ok: `Names drawn. All ${count} emails sent.` }
}

export async function resendFailedEmails(partyId: string, _: FormState): Promise<FormState> {
  const { isHost } = await assertHost(partyId)
  if (!isHost) return { error: "Only the host can resend emails." }
  const { sent, failed } = await sendDrawEmails(partyId, { onlyUnsent: true })
  revalidatePath(`/parties/${partyId}`)
  return failed ? { error: `${failed} still failing. ${sent} sent.` } : { ok: sent ? `${sent} sent.` : "Nothing left to send." }
}

export async function markDrawSeen(partyId: string) {
  const supabase = await createClient()
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("party_id", partyId)
    .is("read_at", null)
  revalidatePath("/dashboard")
}
