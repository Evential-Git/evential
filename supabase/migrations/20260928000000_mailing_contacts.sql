begin;

create table public.mailing_contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  position text not null default '',
  company text not null default '',
  email text not null unique check (email = lower(trim(email)) and length(email) <= 254),
  contact_type text not null default 'Website' check (contact_type in ('Event', 'Investor', 'Mentor', 'Website')),
  unsubscribed boolean not null default false,
  source text not null default 'existing_list' check (source in ('existing_list', 'website')),
  consent_at timestamptz,
  consent_text text,
  created_at timestamptz not null default now(),
  check (source <> 'website' or (consent_at is not null and consent_text is not null))
);

alter table public.mailing_contacts enable row level security;
revoke all on public.mailing_contacts from public, anon, authenticated;
grant select, insert, update, delete on public.mailing_contacts to service_role;

comment on table public.mailing_contacts is
  'Private contact list. Manage in Supabase Table Editor. Always filter unsubscribed = false before sending. Imported consent is unknown; never invent consent timestamps.';

commit;
