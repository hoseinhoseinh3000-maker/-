-- Run this whole file once in Supabase Dashboard > SQL Editor.
-- The first account you create in Authentication will initially have role=member.
-- Promote your own account to admin using the final UPDATE statement below.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null default 'عضو',
  role text not null default 'member' check (role in ('admin','member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.member_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists member_entries_member_created_idx
  on public.member_entries(member_id, created_at desc);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists announcements_created_idx
  on public.announcements(created_at desc);

-- Requests submitted by visitors who do not yet have an account.
-- Public visitors can submit only through the request-access Edge Function.
create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  reason text,
  status text not null default 'pending'
    check (status in ('pending','processing','approved','rejected')),
  request_ip_hash text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_user_id uuid references public.profiles(id) on delete set null
);
create index if not exists registration_requests_status_created_idx
  on public.registration_requests(status, created_at desc);
create index if not exists registration_requests_ip_created_idx
  on public.registration_requests(request_ip_hash, created_at desc);
create unique index if not exists registration_requests_open_email_uidx
  on public.registration_requests(lower(email))
  where status in ('pending','processing');

-- New auth users receive a basic member profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name',''), 'عضو'),
    'member',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sarbazan on auth.users;
create trigger on_auth_user_created_sarbazan
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Security helper: checks role inside the database, not in browser code.
create or replace function public.is_sarbazan_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.is_active = true
  );
$$;

revoke all on function public.is_sarbazan_admin() from public;
grant execute on function public.is_sarbazan_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.member_entries enable row level security;
alter table public.announcements enable row level security;
alter table public.registration_requests enable row level security;

-- Enable live admin notifications for new account requests.
do $
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'registration_requests'
     ) then
    execute 'alter publication supabase_realtime add table public.registration_requests';
  end if;
end
$;

revoke all on public.profiles from anon;
revoke all on public.member_entries from anon;
revoke all on public.announcements from anon;
revoke all on public.registration_requests from anon;
revoke all on public.registration_requests from authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.member_entries to authenticated;
grant select, insert, delete on public.announcements to authenticated;
grant select on public.registration_requests to authenticated;

drop policy if exists "profiles read self or admin" on public.profiles;
create policy "profiles read self or admin" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select public.is_sarbazan_admin()));

drop policy if exists "admin updates profiles" on public.profiles;
create policy "admin updates profiles" on public.profiles
for update to authenticated
using ((select public.is_sarbazan_admin()))
with check ((select public.is_sarbazan_admin()));

drop policy if exists "member reads own entries admin reads all" on public.member_entries;
create policy "member reads own entries admin reads all" on public.member_entries
for select to authenticated
using (member_id = (select auth.uid()) or (select public.is_sarbazan_admin()));

drop policy if exists "admin inserts entries" on public.member_entries;
create policy "admin inserts entries" on public.member_entries
for insert to authenticated
with check ((select public.is_sarbazan_admin()) and created_by = (select auth.uid()));

drop policy if exists "admin deletes entries" on public.member_entries;
create policy "admin deletes entries" on public.member_entries
for delete to authenticated
using ((select public.is_sarbazan_admin()));

drop policy if exists "read active announcements" on public.announcements;
create policy "read active announcements" on public.announcements
for select to authenticated
using (is_active = true or (select public.is_sarbazan_admin()));

drop policy if exists "admin publishes announcements" on public.announcements;
create policy "admin publishes announcements" on public.announcements
for insert to authenticated
with check ((select public.is_sarbazan_admin()) and created_by = (select auth.uid()));

drop policy if exists "admin deletes announcements" on public.announcements;
create policy "admin deletes announcements" on public.announcements
for delete to authenticated
using ((select public.is_sarbazan_admin()));

drop policy if exists "admin reads registration requests" on public.registration_requests;
create policy "admin reads registration requests" on public.registration_requests
for select to authenticated
using ((select public.is_sarbazan_admin()));

-- After creating your own first user in Authentication > Users, replace the email:
-- update public.profiles set role = 'admin' where email = 'YOUR_ADMIN_EMAIL';
