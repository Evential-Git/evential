begin;

alter table public.mailing_contacts
  add column unsubscribe_token text not null
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    unique check (unsubscribe_token ~ '^[0-9a-f]{64}$'),
  add column unsubscribe_url text generated always as
    ('https://evential.co/unsubscribe#token=' || unsubscribe_token) stored,
  add column unsubscribed_at timestamptz;

comment on column public.mailing_contacts.unsubscribe_url is
  'Personal newsletter button URL. Treat as private: anyone holding this link can unsubscribe this contact.';
comment on column public.mailing_contacts.unsubscribed_at is
  'Time recorded by the unsubscribe endpoint. Historical/manual unsubscribes may have no known timestamp.';

create function public.unsubscribe_mailing_contact(p_token text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with changed as (
    update public.mailing_contacts
       set unsubscribed = true,
           unsubscribed_at = coalesce(unsubscribed_at, now())
     where unsubscribe_token = p_token
     returning id
  )
  select exists (select 1 from changed);
$$;

revoke all on function public.unsubscribe_mailing_contact(text) from public, anon, authenticated;
grant execute on function public.unsubscribe_mailing_contact(text) to service_role;

commit;
