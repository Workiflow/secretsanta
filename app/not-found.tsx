import Link from "next/link"
import { Card, Shell, buttonClass } from "@/components/ui"

export default function NotFound() {
  return (
    <Shell>
      <Card>
        <h1 className="font-display text-2xl font-semibold">We couldn't find that</h1>
        <p className="text-muted">The party may have been deleted, or you're not a member of it.</p>
        <div><Link href="/dashboard" className={buttonClass}>Go to your parties</Link></div>
      </Card>
    </Shell>
  )
}
