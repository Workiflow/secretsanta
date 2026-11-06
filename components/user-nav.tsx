import { signOut } from "@/app/actions"
import { linkButtonClass } from "@/components/ui"

export function UserNav({ name }: { name?: string }) {
  return (
    <form action={signOut} className="flex items-center gap-3 text-sm">
      {name && <span className="text-muted">{name}</span>}
      <button type="submit" className={linkButtonClass}>Sign out</button>
    </form>
  )
}
