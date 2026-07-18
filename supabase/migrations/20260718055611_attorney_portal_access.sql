-- Secure read-only attorney access. All access is mediated by Next.js with the
-- Supabase service role; browser roles receive no table or function privileges.

create table if not exists public.records_attorney_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  case_key text not null check (char_length(case_key) between 1 and 120),
  case_id text not null check (char_length(case_id) between 1 and 180),
  invited_email_hash text not null check (char_length(invited_email_hash) = 64),
  invited_email_ciphertext text not null,
  invited_email_nonce text not null,
  invited_email_tag text not null,
  token_hash text not null unique check (char_length(token_hash) = 64),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired', 'replaced')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  replaced_at timestamptz,
  replaced_by_invitation_id uuid references public.records_attorney_invitations(id) on delete set null,
  check (expires_at > created_at)
);

create table if not exists public.records_attorney_grants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  attorney_user_id uuid not null references auth.users(id) on delete cascade,
  invitation_id uuid not null unique references public.records_attorney_invitations(id) on delete cascade,
  case_key text not null check (char_length(case_key) between 1 and 120),
  case_id text not null check (char_length(case_id) between 1 and 180),
  permission_scope text not null default 'read_only'
    check (permission_scope = 'read_only'),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  left_at timestamptz,
  revocation_reason text,
  check (owner_user_id <> attorney_user_id),
  check (expires_at > granted_at)
);

create table if not exists public.records_attorney_access_events (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null,
  actor_user_id uuid,
  case_id text,
  invitation_id uuid,
  grant_id uuid,
  event_type text not null check (
    event_type in (
      'invitation_created',
      'invitation_resent',
      'invitation_accepted',
      'invitation_revoked',
      'attorney_left',
      'portal_accessed',
      'report_generated',
      'report_downloaded',
      'evidence_downloaded',
      'access_denied',
      'access_expired',
      'case_access_invalidated',
      'account_access_invalidated'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (octet_length(metadata::text) <= 1024)
);

create index if not exists records_attorney_invitations_owner_created_idx
  on public.records_attorney_invitations(owner_user_id, created_at desc);
create index if not exists records_attorney_invitations_token_idx
  on public.records_attorney_invitations(token_hash);
create index if not exists records_attorney_grants_attorney_idx
  on public.records_attorney_grants(attorney_user_id, expires_at desc);
create index if not exists records_attorney_grants_owner_idx
  on public.records_attorney_grants(owner_user_id, expires_at desc);
create unique index if not exists records_attorney_one_active_guest_per_owner_idx
  on public.records_attorney_grants(owner_user_id)
  where revoked_at is null and left_at is null;
create unique index if not exists records_attorney_one_pending_invite_per_owner_idx
  on public.records_attorney_invitations(owner_user_id)
  where status = 'pending';
create index if not exists records_attorney_events_owner_created_idx
  on public.records_attorney_access_events(owner_user_id, created_at desc);
create index if not exists records_attorney_events_grant_created_idx
  on public.records_attorney_access_events(grant_id, created_at desc);

alter table public.records_attorney_invitations enable row level security;
alter table public.records_attorney_grants enable row level security;
alter table public.records_attorney_access_events enable row level security;

revoke all on
  public.records_attorney_invitations,
  public.records_attorney_grants,
  public.records_attorney_access_events
from public, anon, authenticated;

revoke all on sequence public.records_attorney_access_events_id_seq
from public, anon, authenticated;

grant select, insert, update, delete on
  public.records_attorney_invitations,
  public.records_attorney_grants,
  public.records_attorney_access_events
to service_role;

grant usage, select on sequence public.records_attorney_access_events_id_seq
to service_role;

create or replace function public.accept_records_attorney_invitation(
  p_token_hash text,
  p_attorney_user_id uuid,
  p_invited_email_hash text
)
returns table (
  grant_id uuid,
  owner_user_id uuid,
  case_key text,
  case_id text,
  access_expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invitation public.records_attorney_invitations%rowtype;
  created_grant public.records_attorney_grants%rowtype;
begin
  select *
  into invitation
  from public.records_attorney_invitations i
  where i.token_hash = p_token_hash
  for update;

  if not found
    or invitation.status <> 'pending'
    or invitation.expires_at <= now()
    or invitation.invited_email_hash <> p_invited_email_hash
    or invitation.owner_user_id = p_attorney_user_id
  then
    if found and invitation.status = 'pending' and invitation.expires_at <= now() then
      update public.records_attorney_invitations
      set status = 'expired'
      where id = invitation.id and status = 'pending';
    end if;
    return;
  end if;

  with expired_grants as (
    update public.records_attorney_grants as g
    set
      revoked_at = expires_at,
      revocation_reason = 'access_expired'
    where g.owner_user_id = invitation.owner_user_id
      and g.revoked_at is null
      and g.left_at is null
      and g.expires_at <= now()
    returning g.id, g.owner_user_id, g.case_id, g.invitation_id
  )
  insert into public.records_attorney_access_events (
    owner_user_id, case_id, invitation_id, grant_id, event_type, metadata
  )
  select
    expired_grants.owner_user_id, expired_grants.case_id,
    expired_grants.invitation_id, expired_grants.id, 'access_expired',
    jsonb_build_object('reason', 'seven_day_access_ended')
  from expired_grants;

  if exists (
    select 1
    from public.records_attorney_grants g
    where g.owner_user_id = invitation.owner_user_id
      and g.revoked_at is null
      and g.left_at is null
      and g.expires_at > now()
  ) then
    return;
  end if;

  insert into public.records_attorney_grants (
    owner_user_id,
    attorney_user_id,
    invitation_id,
    case_key,
    case_id,
    permission_scope,
    granted_at,
    expires_at
  )
  values (
    invitation.owner_user_id,
    p_attorney_user_id,
    invitation.id,
    invitation.case_key,
    invitation.case_id,
    'read_only',
    now(),
    now() + interval '7 days'
  )
  returning * into created_grant;

  update public.records_attorney_invitations
  set
    status = 'accepted',
    accepted_at = now(),
    accepted_by_user_id = p_attorney_user_id
  where id = invitation.id and status = 'pending';

  insert into public.records_attorney_access_events (
    owner_user_id,
    actor_user_id,
    case_id,
    invitation_id,
    grant_id,
    event_type
  )
  values (
    invitation.owner_user_id,
    p_attorney_user_id,
    invitation.case_id,
    invitation.id,
    created_grant.id,
    'invitation_accepted'
  );

  return query
  select
    created_grant.id,
    created_grant.owner_user_id,
    created_grant.case_key,
    created_grant.case_id,
    created_grant.expires_at;
end;
$$;

revoke all on function public.accept_records_attorney_invitation(text, uuid, text)
from public, anon, authenticated;
grant execute on function public.accept_records_attorney_invitation(text, uuid, text)
to service_role;

create or replace function public.replace_records_attorney_invitation(
  p_owner_user_id uuid,
  p_invitation_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  prior public.records_attorney_invitations%rowtype;
  replacement_id uuid;
begin
  select * into prior
  from public.records_attorney_invitations i
  where i.id = p_invitation_id
    and i.owner_user_id = p_owner_user_id
    and i.status in ('pending', 'expired')
  for update;

  if not found then return null; end if;

  update public.records_attorney_invitations
  set status = 'replaced', replaced_at = now()
  where id = prior.id;

  insert into public.records_attorney_invitations (
    owner_user_id, case_key, case_id,
    invited_email_hash, invited_email_ciphertext, invited_email_nonce, invited_email_tag,
    token_hash, status, created_at, expires_at, last_sent_at
  ) values (
    prior.owner_user_id, prior.case_key, prior.case_id,
    prior.invited_email_hash, prior.invited_email_ciphertext, prior.invited_email_nonce,
    prior.invited_email_tag, p_token_hash, 'pending', now(), p_expires_at, now()
  ) returning id into replacement_id;

  update public.records_attorney_invitations
  set replaced_by_invitation_id = replacement_id
  where id = prior.id;

  return replacement_id;
end;
$$;

revoke all on function public.replace_records_attorney_invitation(uuid, uuid, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.replace_records_attorney_invitation(uuid, uuid, text, timestamptz)
to service_role;

create or replace function public.revoke_records_attorney_invitation(
  p_owner_user_id uuid,
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invitation public.records_attorney_invitations%rowtype;
  revoked_grant_id uuid;
begin
  select * into invitation
  from public.records_attorney_invitations i
  where i.id = p_invitation_id
    and i.owner_user_id = p_owner_user_id
    and i.status in ('pending', 'accepted')
  for update;

  if not found then return false; end if;

  update public.records_attorney_invitations
  set status = 'revoked', revoked_at = now()
  where id = invitation.id;

  update public.records_attorney_grants
  set revoked_at = now(), revocation_reason = 'owner_revoked'
  where invitation_id = invitation.id
    and owner_user_id = p_owner_user_id
    and revoked_at is null
    and left_at is null
  returning id into revoked_grant_id;

  insert into public.records_attorney_access_events (
    owner_user_id, actor_user_id, case_id, invitation_id, grant_id, event_type
  ) values (
    p_owner_user_id, p_owner_user_id, invitation.case_id,
    invitation.id, revoked_grant_id, 'invitation_revoked'
  );

  return true;
end;
$$;

revoke all on function public.revoke_records_attorney_invitation(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.revoke_records_attorney_invitation(uuid, uuid)
to service_role;
