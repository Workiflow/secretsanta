import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  deleteParty,
  drawNames,
  leaveParty,
  removeMember,
  resendFailedEmails,
  updateParty,
  updateWishlist,
} from "@/app/actions"
import { ActionForm, ConfirmButton, CopyLink, DrawControl, MarkDrawSeen, SubmitButton } from "@/components/forms"
import { Card, CardTitle, Chip, Field, inputClass, linkButtonClass, Shell, StatusDot } from "@/components/ui"
import { UserNav } from "@/components/user-nav"
import { requireUser } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { siteUrl } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"
import type { Member, Party } from "@/lib/types"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("parties").select("name").eq("id", id).maybeSingle()
  return { title: data?.name ?? "Party" }
}

export default async function PartyPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const user = await requireUser(supabase, `/parties/${id}`)

  const { data: party } = await supabase
    .from("parties")
    .select("id, name, host_id, invite_code, exchange_date, budget, status, drawn_at")
    .eq("id", id)
    .maybeSingle<Party>()
  if (!party) notFound()

  const isHost = party.host_id === user.id
  const drawn = party.status === "drawn"

  const [{ data: memberRows }, { data: assignment }, summaryRes] = await Promise.all([
    supabase.rpc("party_members", { p_party: id }),
    supabase.from("assignments").select("giftee_id").eq("party_id", id).maybeSingle(),
    isHost && drawn ? supabase.rpc("draw_email_summary", { p_party: id }) : Promise.resolve({ data: null }),
  ])
  const members = (memberRows ?? []) as Member[]
  const me = members.find((m) => m.user_id === user.id)
  const giftee = assignment ? members.find((m) => m.user_id === assignment.giftee_id) : undefined
  const summary = (summaryRes.data as { sent: number; failed: number; pending: number }[] | null)?.[0]
  const invite = `${await siteUrl()}/join/${party.invite_code}`

  return (
    <Shell nav={<UserNav name={me?.name} />}>
      <Link href="/dashboard" className={`${linkButtonClass} -mb-6 self-start`}>← All parties</Link>

      <section className="flex flex-col gap-3">
        <StatusDot drawn={drawn} />
        <h1 className="font-display text-[clamp(2.2rem,7vw,3.4rem)] leading-[1.05] font-extrabold tracking-tight">{party.name}</h1>
        <div className="flex flex-wrap gap-2">
          {party.exchange_date && <Chip>Gift exchange: <strong>{formatDate(party.exchange_date)}</strong></Chip>}
          {party.budget && <Chip>Spend limit: <strong>{party.budget}</strong></Chip>}
          {isHost && <Chip>You're the host</Chip>}
        </div>
      </section>

      {drawn && giftee && (
        <section className="tag-hole relative flex flex-col gap-2 rounded-l-lg rounded-r-3xl border-2 border-accent bg-surface py-7 pr-6 pl-12">
          <MarkDrawSeen partyId={id} />
          <p className="text-muted">You're buying for</p>
          <p className="font-display text-[clamp(2.4rem,9vw,4rem)] leading-none font-extrabold text-accent">{giftee.name}</p>
          <div className="mt-3 flex flex-col gap-1">
            <p className="text-sm font-bold">Their gift ideas</p>
            <p className="whitespace-pre-line text-muted">{giftee.wishlist || "Nothing yet. Check back later; they can still add ideas."}</p>
          </div>
          <p className="mt-2 text-sm text-muted">Only you can see this. We emailed it to you too.</p>
        </section>
      )}

      {!drawn && (
        <Card>
          <CardTitle>Invite your family</CardTitle>
          <p className="text-muted">Send this link to everyone taking part. They add their name and email, then confirm they're joining. It works until names are drawn.</p>
          <CopyLink value={invite} />
        </Card>
      )}

      {me && (
        <Card>
          <CardTitle>Your gift ideas</CardTitle>
          <p className="text-sm text-muted">Shown only to whoever draws you{drawn ? ". They see changes straight away." : "."}</p>
          <ActionForm action={updateWishlist.bind(null, id)}>
            <textarea name="wishlist" aria-label="Your gift ideas" maxLength={500} rows={3} defaultValue={me.wishlist} className={inputClass} placeholder="Books, good coffee, anything for the garden" />
            <div><SubmitButton variant="ghost" pending="Saving…">Save ideas</SubmitButton></div>
          </ActionForm>
        </Card>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold">Who's in</h2>
          <Chip><strong className="tabular-nums">{members.length}</strong> {members.length === 1 ? "person" : "people"}</Chip>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.user_id} className={`tag-hole relative flex min-w-0 flex-col gap-0.5 rounded-l-md rounded-r-2xl border bg-surface py-3.5 pr-4 pl-10 ${m.user_id === user.id ? "border-pine" : "border-line"}`}>
              <span className="font-display font-semibold break-words">
                {m.name}
                {m.user_id === user.id && <span className="font-sans font-normal text-muted"> (you)</span>}
                {m.is_host && <span className="ml-2 rounded-full bg-pine/15 px-2 py-0.5 font-sans text-xs font-bold text-pine">Host</span>}
              </span>
              {isHost && m.email && <span className="text-sm break-all text-muted">{m.email}</span>}
              {isHost && !drawn && !m.is_host && (
                <ConfirmButton action={removeMember.bind(null, id, m.user_id)} label="Remove" confirmLabel="Remove" question={`Remove ${m.name}?`} />
              )}
            </li>
          ))}
        </ul>
      </section>

      {isHost && (
        <section className="flex flex-col gap-6 border-t-2 border-ink pt-6">
          <p className="text-xs font-bold tracking-widest text-muted uppercase">Host tools</p>

          <Card>
            <CardTitle>{drawn ? "The draw" : "Draw names"}</CardTitle>
            {!drawn ? (
              <DrawControl action={drawNames.bind(null, id)} count={members.length} />
            ) : (
              <div className="flex flex-col gap-3">
                <p>
                  Drawn {party.drawn_at && new Date(party.drawn_at).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}.{" "}
                  {summary && <strong>{summary.sent} of {summary.sent + summary.failed + summary.pending} emails sent.</strong>}
                </p>
                <p className="text-sm text-muted">You can't see who has whom, so you can play too. Everyone can also see their giftee on this page.</p>
                {summary && summary.failed + summary.pending > 0 && (
                  <ActionForm action={resendFailedEmails.bind(null, id)}>
                    <p className="text-sm text-bad">{summary.failed + summary.pending} {summary.failed + summary.pending === 1 ? "email hasn't" : "emails haven't"} gone out.</p>
                    <div><SubmitButton pending="Sending…">Resend unsent emails</SubmitButton></div>
                  </ActionForm>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>Party details</CardTitle>
            <ActionForm action={updateParty.bind(null, id)}>
              <Field label="Party name">
                <input name="name" required maxLength={80} defaultValue={party.name} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Exchange date">
                  <input name="exchange_date" type="date" defaultValue={party.exchange_date ?? ""} className={inputClass} />
                </Field>
                <Field label="Spend limit">
                  <input name="budget" maxLength={40} defaultValue={party.budget ?? ""} className={inputClass} />
                </Field>
              </div>
              <div><SubmitButton variant="ghost" pending="Saving…">Save details</SubmitButton></div>
            </ActionForm>
          </Card>

          <ConfirmButton action={deleteParty.bind(null, id)} label="Delete this party" confirmLabel="Delete for everyone" question="Delete the party and everyone's draw?" />
        </section>
      )}

      {!isHost && !drawn && (
        <ConfirmButton action={leaveParty.bind(null, id)} label="Leave this party" confirmLabel="Leave" question="Leave the party?" />
      )}
    </Shell>
  )
}
