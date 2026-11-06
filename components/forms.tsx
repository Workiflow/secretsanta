"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import type { FormState, SignInState } from "@/app/actions"
import { markDrawSeen, signIn } from "@/app/actions"
import { buttonClass, Field, ghostButtonClass, inputClass, linkButtonClass } from "@/components/ui"

export function SubmitButton({ children, pending, variant = "primary", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: string; variant?: "primary" | "ghost" }) {
  const status = useFormStatus()
  return (
    <button type="submit" disabled={status.pending || rest.disabled} className={variant === "primary" ? buttonClass : ghostButtonClass} {...rest}>
      {status.pending && pending ? pending : children}
    </button>
  )
}

function Message({ state }: { state: FormState | SignInState | null }) {
  if (!state) return null
  if (state.error) return <p role="alert" className="text-sm text-bad">{state.error}</p>
  if ("ok" in state && state.ok) return <p role="status" className="text-sm text-ok">{state.ok}</p>
  return null
}

export function ActionForm({ action, children, className = "flex flex-col gap-4" }: {
  action: (state: FormState, fd: FormData) => Promise<FormState>
  children: React.ReactNode
  className?: string
}) {
  const [state, formAction] = useActionState(action, null)
  return (
    <form action={formAction} className={className}>
      {children}
      <Message state={state} />
    </form>
  )
}

export function SignInForm({ next, cta = "Email me a code" }: { next: string; cta?: string }) {
  const [state, formAction] = useActionState(signIn, { step: "details", next })
  const codeRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (state.step === "code") codeRef.current?.focus() }, [state.step])

  if (state.step === "code") {
    return (
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <p>
          We sent a code to <strong className="break-all">{state.email}</strong>. It can take a minute; check spam if it's not there.
        </p>
        <Field label="Code from the email">
          <input ref={codeRef} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,12}" required className={`${inputClass} font-mono text-lg tracking-[0.3em]`} placeholder="123456" />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pending="Checking…">Continue</SubmitButton>
          <button type="submit" name="intent" value="resend" formNoValidate className={linkButtonClass}>Send a new code</button>
          <button type="submit" name="intent" value="back" formNoValidate className={linkButtonClass}>Use a different email</button>
        </div>
        <Message state={state} />
      </form>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name">
          <input name="name" autoComplete="name" required maxLength={60} className={inputClass} placeholder="Gran" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className={inputClass} placeholder="you@example.com" />
        </Field>
      </div>
      <div>
        <SubmitButton pending="Sending…">{cta}</SubmitButton>
      </div>
      <p className="text-sm text-muted">No password. We email you a short code each time you sign in.</p>
      <Message state={state} />
    </form>
  )
}

export function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input ref={inputRef} readOnly value={value} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className={`${inputClass} min-w-0 font-mono text-sm`} />
      <button
        type="button"
        className={buttonClass}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            inputRef.current?.select()
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  )
}

export function DrawControl({ action, count }: { action: (s: FormState) => Promise<FormState>; count: number }) {
  const [confirming, setConfirming] = useState(false)
  const [state, formAction] = useActionState(action, null)
  const ready = count >= 3

  if (!confirming) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted">
          {ready
            ? `Shuffles all ${count} people into one loop. Each person gets an email and sees their giftee here. Nobody, including you, sees anyone else's.`
            : `You need at least 3 people. ${count} so far.`}
        </p>
        <div>
          <button type="button" disabled={!ready} className={buttonClass} onClick={() => setConfirming(true)}>Draw names</button>
        </div>
        <Message state={state} />
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-accent p-4">
      <p><strong>Draw names for all {count} people now?</strong> The party closes to new people and the draw can't be undone.</p>
      <div className="flex flex-wrap gap-3">
        <SubmitButton pending="Drawing and emailing…">Yes, draw names</SubmitButton>
        <button type="button" className={ghostButtonClass} onClick={() => setConfirming(false)}>Not yet</button>
      </div>
      <Message state={state} />
    </form>
  )
}

export function ConfirmButton({ action, label, confirmLabel, question }: { action: () => Promise<void>; label: string; confirmLabel: string; question: string }) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) return <button type="button" className={linkButtonClass} onClick={() => setConfirming(true)}>{label}</button>
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 text-sm">
      <span>{question}</span>
      <SubmitButton variant="ghost" pending="…">{confirmLabel}</SubmitButton>
      <button type="button" className={linkButtonClass} onClick={() => setConfirming(false)}>Cancel</button>
    </form>
  )
}

export function MarkDrawSeen({ partyId }: { partyId: string }) {
  useEffect(() => { markDrawSeen(partyId) }, [partyId])
  return null
}
