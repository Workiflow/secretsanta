import type { Metadata } from "next"
import Link from "next/link"
import { createParty, goToInvite, updateName } from "@/app/actions"
import { ActionForm, SubmitButton } from "@/components/forms"
import { Card, CardTitle, Field, inputClass, Shell, StatusDot } from "@/components/ui"
import { UserNav } from "@/components/user-nav"
import { requireUser } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"
import type { Party } from "@/lib/types"

export const metadata: Metadata = { title: "Your parties" }

export default async function Dashboard() {
  const supabase = await createClient()
  const user = await requireUser(supabase)

  const [{ data: profile }, { data: memberships }, { data: unread }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).single(),
    supabase
      .from("memberships")
      .select("joined_at, party:parties(id, name, host_id, status, exchange_date, budget)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),
    supabase.from("notifications").select("id, party_id, party:parties(name)").is("read_at", null).order("created_at", { ascending: false }),
  ])

  const parties = (memberships ?? []).map((m) => m.party as unknown as Party).filter(Boolean)
  const notices = (unread ?? []) as unknown as { id: string; party_id: string; party: { name: string } | null }[]

  return (
    <Shell nav={<UserNav name={profile?.name} />}>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Hi {profile?.name ?? "there"}</h1>

      {notices.length > 0 && (
        <section aria-label="Notifications" className="flex flex-col gap-3">
          {notices.map((n) => (
            <Link key={n.id} href={`/parties/${n.party_id}`} className="tag-hole relative flex flex-col gap-1 rounded-2xl border-2 border-accent bg-surface py-4 pr-5 pl-10 hover:brightness-105">
              <span className="text-sm font-bold text-accent">New</span>
              <span>Names have been drawn for <strong>{n.party?.name ?? "your party"}</strong>. See who you're buying for →</span>
            </Link>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-semibold">Your parties</h2>
        {parties.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">
            You're not in any parties yet. Start one below, or open the invite link someone sent you.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {parties.map((p) => (
              <li key={p.id}>
                <Link href={`/parties/${p.id}`} className="tag-hole relative flex h-full flex-col gap-1 rounded-l-md rounded-r-2xl border border-line bg-surface py-4 pr-5 pl-10 transition hover:border-ink">
                  <span className="font-display text-lg font-semibold">{p.name}</span>
                  <StatusDot drawn={p.status === "drawn"} />
                  <span className="text-sm text-muted">
                    {[p.host_id === user.id ? "You're hosting" : null, formatDate(p.exchange_date), p.budget].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardTitle>Start a party</CardTitle>
          <ActionForm action={createParty}>
            <Field label="Party name">
              <input name="name" required maxLength={80} className={inputClass} placeholder="Theron Christmas 2026" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Exchange date">
                <input name="exchange_date" type="date" className={inputClass} />
              </Field>
              <Field label="Spend limit">
                <input name="budget" maxLength={40} className={inputClass} placeholder="R500" />
              </Field>
            </div>
            <div><SubmitButton pending="Creating…">Create party</SubmitButton></div>
          </ActionForm>
        </Card>

        <Card>
          <CardTitle>Join a party</CardTitle>
          <p className="text-sm text-muted">Got an invite? Open the link, or paste it here.</p>
          <ActionForm action={goToInvite}>
            <Field label="Invite link or code">
              <input name="code" required className={inputClass} placeholder="https://…/join/ABCD234XYZ" />
            </Field>
            <div><SubmitButton variant="ghost">Continue</SubmitButton></div>
          </ActionForm>
        </Card>
      </div>

      <Card>
        <CardTitle>Your name</CardTitle>
        <ActionForm action={updateName} className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <input name="name" aria-label="Your name" required maxLength={60} defaultValue={profile?.name ?? ""} className={inputClass} />
          <SubmitButton variant="ghost" pending="Saving…">Save</SubmitButton>
        </ActionForm>
      </Card>
    </Shell>
  )
}
