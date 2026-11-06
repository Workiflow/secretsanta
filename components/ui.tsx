import Link from "next/link"

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-accent bg-accent px-5 py-2.5 font-bold text-accent-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
export const ghostButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-transparent px-5 py-2.5 font-bold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-55"
export const linkButtonClass = "text-sm text-muted underline underline-offset-2 hover:text-ink"
export const inputClass =
  "w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-ink placeholder:text-muted/70 focus:border-ink focus:outline-none"

export function Shell({ children, nav }: { children: React.ReactNode; nav?: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pt-6 pb-20 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
          Out of the <span className="text-accent">Hat</span>
        </Link>
        {nav}
      </header>
      {children}
    </div>
  )
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</section>
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl font-semibold">{children}</h2>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold">
      <span>
        {label} {hint && <span className="font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line bg-surface px-3 py-1 text-sm">{children}</span>
}

export function StatusDot({ drawn }: { drawn: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-bold">
      <span className={`size-2.5 rounded-full ${drawn ? "bg-accent" : "bg-ok"}`} />
      {drawn ? "Names drawn" : "Open for joining"}
    </span>
  )
}
