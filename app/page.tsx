import { redirect } from "next/navigation"
import { SignInForm } from "@/components/forms"
import { Card, Shell } from "@/components/ui"
import { getUser, safeNext } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function Home({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const supabase = await createClient()
  if (await getUser(supabase)) redirect(safeNext(next))

  return (
    <Shell>
      <section className="flex flex-col gap-4 pt-6">
        <h1 className="font-display text-[clamp(2.4rem,8vw,4rem)] leading-[1.02] font-extrabold tracking-tight">
          Draw names for the <span className="text-accent">whole family.</span>
        </h1>
        <p className="max-w-[60ch] text-lg text-muted">
          Start a Christmas party, send everyone one link, and draw names when they've all joined. Each person finds out who they're buying for by email and in the app. Nobody else sees it.
        </p>
      </section>

      <Card>
        <h2 className="font-display text-xl font-semibold">Sign in or create an account</h2>
        <SignInForm next={safeNext(next)} />
      </Card>

      <ol className="grid gap-4 sm:grid-cols-3">
        {[
          ["Start a party", "Name it, set the spend limit and the exchange date."],
          ["Share the link", "Family open it, add their name and email, and join."],
          ["Draw names", "Everyone gets their giftee by email and on the party page."],
        ].map(([title, body], i) => (
          <li key={title} className="flex flex-col gap-1 border-t-2 border-ink pt-3">
            <span className="text-sm text-muted">Step {i + 1}</span>
            <span className="font-display text-lg font-semibold">{title}</span>
            <span className="text-sm text-muted">{body}</span>
          </li>
        ))}
      </ol>
    </Shell>
  )
}
