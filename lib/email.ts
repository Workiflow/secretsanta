import { formatDate } from "@/lib/format"

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export function drawEmail(input: {
  giverName: string
  gifteeName: string
  wishlist: string
  partyName: string
  exchangeDate: string | null
  budget: string | null
  link: string
}) {
  const { giverName, gifteeName, wishlist, partyName, exchangeDate, budget, link } = input
  const date = formatDate(exchangeDate)
  const ideas = wishlist.trim()
    ? `Gift ideas from ${gifteeName}: ${wishlist.trim()}`
    : `${gifteeName} hasn't added gift ideas yet. Check the party page later.`

  const text = [
    `Hi ${giverName},`,
    "",
    `Names have been drawn for ${partyName}.`,
    "",
    `You're buying for ${gifteeName}.`,
    "",
    ideas,
    budget ? `Spend limit: ${budget}` : null,
    date ? `Gift exchange: ${date}` : null,
    "",
    `See it any time: ${link}`,
    "",
    "Keep it secret.",
  ]
    .filter((l) => l !== null)
    .join("\n")

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#5a6b62">${esc(label)}</td><td style="padding:4px 0">${esc(value)}</td></tr>`

  const html = `<!doctype html><html><body style="margin:0;background:#f3f5f2;padding:32px 16px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#14251c">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #d6dfd9;border-radius:16px;padding:32px">
<p style="margin:0 0 8px;color:#5a6b62;font-size:14px">${esc(partyName)}</p>
<p style="margin:0 0 24px;font-size:16px">Hi ${esc(giverName)}, names have been drawn.</p>
<p style="margin:0;color:#5a6b62;font-size:14px">You're buying for</p>
<p style="margin:4px 0 24px;font-size:32px;font-weight:700;color:#b3243b">${esc(gifteeName)}</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${esc(ideas)}</p>
${budget || date ? `<table style="font-size:14px;margin:0 0 24px;border-collapse:collapse">${budget ? row("Spend limit", budget) : ""}${date ? row("Gift exchange", date) : ""}</table>` : ""}
<a href="${esc(link)}" style="display:inline-block;background:#b3243b;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Open the party</a>
<p style="margin:24px 0 0;color:#5a6b62;font-size:13px">Keep it secret.</p>
</div></body></html>`

  return { subject: `${partyName}: you're buying for…`, text, html }
}
