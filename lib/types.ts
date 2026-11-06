export type Party = {
  id: string
  name: string
  host_id: string
  invite_code: string
  exchange_date: string | null
  budget: string | null
  status: "open" | "drawn"
  drawn_at: string | null
}

export type Member = {
  user_id: string
  name: string
  email: string | null
  wishlist: string
  joined_at: string
  is_host: boolean
}

export type Invite = {
  party_id: string
  name: string
  host_name: string
  exchange_date: string | null
  budget: string | null
  status: "open" | "drawn"
  member_count: number
  is_member: boolean
}
