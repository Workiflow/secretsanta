-- Out of the Hat: multi-party Secret Santa.
-- Every write that matters (join, draw) goes through a security-definer function,
-- so the rules live here and not in the app. Nobody, the host included, can read
-- another person's assignment.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  email text not null,
  created_at timestamptz not null default now()
);

-- 10 characters from an unambiguous alphabet (~50 bits). gen_random_uuid() is
-- cryptographically random, so byte 0 of a fresh one is a safe random byte.
create or replace function public.gen_invite_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(uuid_send(gen_random_uuid()), 0) % 31), 1), '')
  from generate_series(1, 10)
$$;

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  invite_code text not null unique default public.gen_invite_code(),
  exchange_date date,
  budget text check (char_length(budget) <= 40),
  status text not null default 'open' check (status in ('open', 'drawn')),
  drawn_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.memberships (
  party_id uuid not null references public.parties on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  wishlist text not null default '' check (char_length(wishlist) <= 500),
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.assignments (
  party_id uuid not null references public.parties on delete cascade,
  giver_id uuid not null references public.profiles on delete cascade,
  giftee_id uuid not null references public.profiles on delete cascade,
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed')),
  email_error text,
  created_at timestamptz not null default now(),
  primary key (party_id, giver_id),
  unique (party_id, giftee_id),
  check (giver_id <> giftee_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  party_id uuid not null references public.parties on delete cascade,
  kind text not null check (kind in ('draw')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 60),
    new.email
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The host is always a member of their own party.
create or replace function public.add_host_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.memberships (party_id, user_id) values (new.id, new.host_id);
  return new;
end $$;

create trigger on_party_created
  after insert on public.parties
  for each row execute function public.add_host_membership();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_member(p_party uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships
    where party_id = p_party and user_id = (select auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.parties enable row level security;
alter table public.memberships enable row level security;
alter table public.assignments enable row level security;
alter table public.notifications enable row level security;

-- Profiles: your own row only. Other members' names come from party_members().
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Parties: members read; anyone signed in creates one they host; host edits/deletes.
create policy "members read party" on public.parties
  for select to authenticated using (host_id = (select auth.uid()) or public.is_member(id));
create policy "create own party" on public.parties
  for insert to authenticated with check (host_id = (select auth.uid()));
create policy "host edits party" on public.parties
  for update to authenticated using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));
create policy "host deletes party" on public.parties
  for delete to authenticated using (host_id = (select auth.uid()));

-- Memberships: read your own (the dashboard list); the host also reads their
-- party's rows, which a delete needs to see. Edit your own wishlist.
-- Before the draw, members may leave and the host may remove others.
create policy "read own or hosted memberships" on public.memberships
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.parties p where p.id = party_id and p.host_id = (select auth.uid()))
  );
create policy "edit own wishlist" on public.memberships
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "leave or remove before draw" on public.memberships
  for delete to authenticated using (
    exists (
      select 1 from public.parties p
      where p.id = party_id and p.status = 'open' and (
        (user_id = (select auth.uid()) and p.host_id <> (select auth.uid()))
        or (p.host_id = (select auth.uid()) and user_id <> (select auth.uid()))
      )
    )
  );

-- Assignments: only the giver sees their own row. Written by draw_names() and the server.
create policy "giver reads own assignment" on public.assignments
  for select to authenticated using (giver_id = (select auth.uid()));

-- Notifications: your own.
create policy "read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Column-level grants: users can only touch the fields they own.
revoke all on public.profiles, public.parties, public.memberships, public.assignments, public.notifications from anon;
revoke insert, update, delete on public.profiles, public.memberships, public.assignments, public.notifications from authenticated;
revoke insert, update on public.parties from authenticated;
grant update (name) on public.profiles to authenticated;
grant insert (name, exchange_date, budget) on public.parties to authenticated;
grant update (name, exchange_date, budget) on public.parties to authenticated;
grant update (wishlist) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- What the invite page shows before someone has joined (or signed in).
create or replace function public.get_invite(p_code text)
returns table (
  party_id uuid, name text, host_name text, exchange_date date, budget text,
  status text, member_count int, is_member boolean
)
language sql stable security definer set search_path = '' as $$
  select pa.id, pa.name, pr.name, pa.exchange_date, pa.budget, pa.status,
    (select count(*)::int from public.memberships m where m.party_id = pa.id),
    public.is_member(pa.id)
  from public.parties pa
  join public.profiles pr on pr.id = pa.host_id
  where pa.invite_code = upper(trim(p_code))
$$;

create or replace function public.join_party(p_code text, p_wishlist text default '')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_party public.parties;
begin
  if v_uid is null then
    raise exception 'Sign in to join this party.' using errcode = '42501';
  end if;

  -- FOR SHARE blocks a concurrent draw until this join commits.
  select * into v_party from public.parties where invite_code = upper(trim(p_code)) for share;
  if not found then
    raise exception 'That invite link isn''t valid. Ask the host for a new one.' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.memberships where party_id = v_party.id and user_id = v_uid) then
    return v_party.id;
  end if;

  if v_party.status <> 'open' then
    raise exception 'Names have already been drawn for this party, so it''s closed to new people.' using errcode = 'P0001';
  end if;

  insert into public.memberships (party_id, user_id, wishlist)
  values (v_party.id, v_uid, left(coalesce(trim(p_wishlist), ''), 500));
  return v_party.id;
end $$;

-- Members list. Emails are visible to the host (and your own) only.
create or replace function public.party_members(p_party uuid)
returns table (user_id uuid, name text, email text, wishlist text, joined_at timestamptz, is_host boolean)
language sql stable security definer set search_path = '' as $$
  select m.user_id, pr.name,
    case when pa.host_id = (select auth.uid()) or m.user_id = (select auth.uid()) then pr.email end,
    m.wishlist, m.joined_at, m.user_id = pa.host_id
  from public.memberships m
  join public.profiles pr on pr.id = m.user_id
  join public.parties pa on pa.id = m.party_id
  where m.party_id = p_party and public.is_member(p_party)
  order by m.joined_at
$$;

-- The draw: one shuffled loop, each person gives to the next, so nobody draws
-- themselves. Atomic and race-safe: the party row is locked for the duration.
create or replace function public.draw_names(p_party uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_party public.parties;
  v_ids uuid[];
  n int;
begin
  select * into v_party from public.parties where id = p_party for update;
  if not found or v_party.host_id <> (select auth.uid()) then
    raise exception 'Only the host can draw names.' using errcode = '42501';
  end if;
  if v_party.status <> 'open' then
    raise exception 'Names have already been drawn for this party.' using errcode = 'P0001';
  end if;

  select array_agg(user_id order by random()) into v_ids
  from public.memberships where party_id = p_party;
  n := coalesce(array_length(v_ids, 1), 0);
  if n < 3 then
    raise exception 'You need at least 3 people to draw names. % so far.', n using errcode = 'P0001';
  end if;

  insert into public.assignments (party_id, giver_id, giftee_id)
  select p_party, v_ids[i], v_ids[(i % n) + 1] from generate_series(1, n) as i;

  insert into public.notifications (user_id, party_id, kind)
  select v_ids[i], p_party, 'draw' from generate_series(1, n) as i;

  update public.parties set status = 'drawn', drawn_at = now() where id = p_party;
  return n;
end $$;

-- Delivery counts for the host. Counts only, never who has whom.
create or replace function public.draw_email_summary(p_party uuid)
returns table (sent int, failed int, pending int)
language sql stable security definer set search_path = '' as $$
  select
    count(*) filter (where a.email_status = 'sent')::int,
    count(*) filter (where a.email_status = 'failed')::int,
    count(*) filter (where a.email_status = 'pending')::int
  from public.assignments a
  join public.parties pa on pa.id = a.party_id
  where a.party_id = p_party and pa.host_id = (select auth.uid())
$$;

-- Supabase grants EXECUTE to anon/authenticated by default; tighten it.
revoke execute on function
  public.gen_invite_code(), public.handle_new_user(), public.add_host_membership(),
  public.is_member(uuid), public.get_invite(text), public.join_party(text, text),
  public.party_members(uuid), public.draw_names(uuid), public.draw_email_summary(uuid)
  from public, anon, authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function
  public.is_member(uuid), public.gen_invite_code(), public.join_party(text, text),
  public.party_members(uuid), public.draw_names(uuid), public.draw_email_summary(uuid)
  to authenticated;
