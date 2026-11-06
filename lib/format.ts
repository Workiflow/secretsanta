export function formatDate(iso: string | null | undefined) {
  if (!iso) return ""
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}
