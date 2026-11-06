import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { joinParty } from "@/app/actions"
import { ActionForm, SignInForm, SubmitButton } from "@/components/forms"
import { buttonClass, Card, Chip, Field, inputClass, Shell } from "@/components/ui"
import { UserNav } from "@/components/user-nav"
import { getUser } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"
import type { Invite } from "@/lib/types"

export const metadata: Metadata = { title: "You're invited" }

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()
  const user = await getUser(supabase)
  const { data } = await supabase.rpc("get_invite", { p_code: code })
  const invite = (data as Invite[] | null)?.[0]

  if (!invite) {
    return (
      <Shell>
        <Card>
          <h1 className="font-display text-2xl font-semibold">That invite link doesn't work</h1>
          <p className="text-muted">Check you copied the whole link, or ask the host to send it again.</p>
        </Card>
      </Shell>
    )
  }
  if (invite.is_member) redirect(`/parties/${invite.party_id}`)

  const { data: profile } = user ? await supabase.from("profiles").select("name").eq("id", user.id).single() : { data: null }
  const closed = invite.status === "drawn"

  return (
    <Shell nav={user ? <UserNav name={profile?.name} /> : undefined}>
      <section className="flex flex-col gap-3 pt-4">
        <p className="text-muted">{invite.host_name} invited you to</p>
        <h1 className="font-display text-[clamp(2.2rem,7vw,3.4rem)] leading-[1.05] font-extrabold tracking-tight">{invite.name}</h1>
        <div className="flex flex-wrap gap-2">
          {invite.exchange_date && <Chip>Gift exchange: <strong>{formatDate(invite.exchange_date)}</strong></Chip>}
          {invite.budget && <Chip>Spend limit: <strong>{invite.budget}</strong></Chip>}
          <Chip><strong className="tabular-nums">{invite.member_count}</strong> {invite.member_count === 1 ? "person" : "people"} in so far</Chip>
        </div>
      </section>

      {closed ? (
        <Card>
          <h2 className="font-display text-xl font-semibold">Names have already been drawn</h2>
          <p className="text-muted">This party is closed to new people. Ask {invite.host_name} if you were missed.</p>
          {user && <div><Link href="/dashboard" className={buttonClass}>Go to your parties</Link></div>}
        </Card>
      ) : !user ? (
        <Card>
          <h2 className="font-display text-xl font-semibold">Step 1: tell us who you are</h2>
          <SignInForm next={`/join/${code}`} cta="Email me a code" />
        </Card>
      ) : (
        <Card>
          <h2 className="font-display text-xl font-semibold">Join {invite.name}?</h2>
          <p>You're joining as <strong>{profile?.name}</strong> ({user.email}). When names are drawn, we'll email you and show you here who you're buying for.</p>
          <ActionForm action={joinParty.bind(null, code)}>
            <Field label="Gift ideas" hint="(optional, shown to whoever draws you)">
              <textarea name="wishlist" maxLength={500} rows={3} className={inputClass} placeholder="Books, good coffee, anything for the garden" />
            </Field>
            <div><SubmitButton pending="Joining…">Join the party</SubmitButton></div>
          </ActionForm>
        </Card>
      )}
    </Shell>
  )
}
