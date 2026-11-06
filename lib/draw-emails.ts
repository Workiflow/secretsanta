import "server-only"
import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"
import { drawEmail } from "@/lib/email"
import { siteUrl } from "@/lib/site"

const BATCH = 100 // Resend batch limit

// Sends each giver their giftee. Call only after checking the caller is the host.
export async function sendDrawEmails(partyId: string, { onlyUnsent }: { onlyUnsent: boolean }) {
  const admin = createAdminClient()

  const { data: party } = await admin
    .from("parties")
    .select("name, exchange_date, budget")
    .eq("id", partyId)
    .single()

  let query = admin.from("assignments").select("giver_id, giftee_id").eq("party_id", partyId)
  if (onlyUnsent) query = query.neq("email_status", "sent")
  const { data: rows } = await query
  if (!party || !rows?.length) return { sent: 0, failed: 0 }

  const ids = [...new Set(rows.flatMap((r) => [r.giver_id, r.giftee_id]))]
  const [{ data: profiles }, { data: members }] = await Promise.all([
    admin.from("profiles").select("id, name, email").in("id", ids),
    admin.from("memberships").select("user_id, wishlist").eq("party_id", partyId),
  ])
  const profile = new Map((profiles ?? []).map((p) => [p.id, p]))
  const wishlist = new Map((members ?? []).map((m) => [m.user_id, m.wishlist as string]))

  const link = `${await siteUrl()}/parties/${partyId}`
  const from = process.env.EMAIL_FROM
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  let sent = 0
  let failed = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    let error: string | null = null

    if (!resend || !from) {
      error = "Email isn't configured (RESEND_API_KEY / EMAIL_FROM)."
    } else {
      try {
        const res = await resend.batch.send(
          chunk.map((r) => {
            const giver = profile.get(r.giver_id)!
            const giftee = profile.get(r.giftee_id)!
            const email = drawEmail({
              giverName: giver.name,
              gifteeName: giftee.name,
              wishlist: wishlist.get(r.giftee_id) ?? "",
              partyName: party.name,
              exchangeDate: party.exchange_date,
              budget: party.budget,
              link,
            })
            return { from, to: [giver.email], subject: email.subject, html: email.html, text: email.text }
          }),
        )
        if (res.error) error = res.error.message
      } catch (e) {
        error = e instanceof Error ? e.message : "Email provider didn't respond."
      }
    }

    await admin
      .from("assignments")
      .update({ email_status: error ? "failed" : "sent", email_error: error })
      .eq("party_id", partyId)
      .in("giver_id", chunk.map((r) => r.giver_id))

    if (error) failed += chunk.length
    else sent += chunk.length
  }

  return { sent, failed }
}
