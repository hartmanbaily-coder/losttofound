-- New attorney acceptances receive 30 days of access. Existing grants retain
-- the duration the owner authorized when those invitations were accepted.

alter table public.records_attorney_invitations
  add column if not exists onboarding_token_hash text
    check (onboarding_token_hash is null or char_length(onboarding_token_hash) = 64),
  add column if not exists onboarding_expires_at timestamptz,
  add column if not exists onboarding_password_required boolean not null default false,
  add column if not exists onboarding_password_established_at timestamptz;

alter table public.records_profiles
  add column if not exists credential_version text
    check (credential_version is null or char_length(credential_version) = 43);

create unique index if not exists records_attorney_invitations_onboarding_token_idx
  on public.records_attorney_invitations(onboarding_token_hash)
  where onboarding_token_hash is not null;

create or replace function public.complete_records_attorney_onboarding(
  p_invitation_id uuid,
  p_onboarding_token_hash text,
  p_acceptance_token_hash text,
  p_attorney_user_id uuid,
  p_invited_email_hash text,
  p_email text,
  p_password_setup_required boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_password_setup_required then
    update public.records_attorney_invitations
    set onboarding_password_required = true
    where id = p_invitation_id
      and status = 'pending'
      and expires_at > now()
      and onboarding_token_hash = p_onboarding_token_hash
      and onboarding_expires_at > now()
      and invited_email_hash = p_invited_email_hash;
  else
    update public.records_attorney_invitations
    set
      token_hash = p_acceptance_token_hash,
      onboarding_token_hash = null,
      onboarding_expires_at = null,
      onboarding_password_required = false
    where id = p_invitation_id
      and status = 'pending'
      and expires_at > now()
      and onboarding_token_hash = p_onboarding_token_hash
      and onboarding_expires_at > now()
      and invited_email_hash = p_invited_email_hash;
  end if;

  if not found then
    return false;
  end if;

  -- A new identity is not approved for application login until its password has
  -- been replaced. Existing approved identities use the immediate branch.
  if not p_password_setup_required then
    insert into public.records_profiles (user_id, email, updated_at)
    values (p_attorney_user_id, lower(trim(p_email)), now())
    on conflict (user_id) do update
    set email = excluded.email, updated_at = excluded.updated_at;
  end if;

  return true;
end;
$$;

revoke all on function public.complete_records_attorney_onboarding(
  uuid, text, text, uuid, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.complete_records_attorney_onboarding(
  uuid, text, text, uuid, text, text, boolean
) to service_role;

create or replace function public.complete_records_attorney_password_setup(
  p_invitation_id uuid,
  p_onboarding_token_hash text,
  p_attorney_user_id uuid,
  p_invited_email_hash text,
  p_email text,
  p_credential_version text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_credential_version is null or char_length(p_credential_version) <> 43 then
    return false;
  end if;

  update public.records_attorney_invitations
  set
    token_hash = onboarding_token_hash,
    onboarding_token_hash = null,
    onboarding_expires_at = null,
    onboarding_password_required = false,
    onboarding_password_established_at = now()
  where id = p_invitation_id
    and status = 'pending'
    and expires_at > now()
    and onboarding_token_hash = p_onboarding_token_hash
    and onboarding_expires_at > now()
    and onboarding_password_required = true
    and invited_email_hash = p_invited_email_hash;

  if not found then
    return false;
  end if;

  insert into public.records_profiles (user_id, email, credential_version, updated_at)
  values (p_attorney_user_id, lower(trim(p_email)), p_credential_version, now())
  on conflict (user_id) do update
  set
    email = excluded.email,
    credential_version = excluded.credential_version,
    updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.complete_records_attorney_password_setup(uuid, text, uuid, text, text, text)
from public, anon, authenticated;
grant execute on function public.complete_records_attorney_password_setup(uuid, text, uuid, text, text, text)
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
    jsonb_build_object('reason', 'access_period_ended')
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
    now() + interval '30 days'
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
