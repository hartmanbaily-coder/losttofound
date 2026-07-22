-- Keep account deletion transactional inside Postgres. Deleting an Auth user
-- now cascades through child-support rows and owner access events, while
-- preserving other owners' event history without the deleted actor identity.

alter table public.records_child_support_payments
  drop constraint if exists records_child_support_payments_child_support_order_id_fkey;

alter table public.records_child_support_payments
  add constraint records_child_support_payments_child_support_order_id_fkey
  foreign key (child_support_order_id)
  references public.records_child_support_orders(id)
  on delete cascade
  not valid;

alter table public.records_child_support_payments
  validate constraint records_child_support_payments_child_support_order_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'records_attorney_access_events_owner_user_id_fkey'
      and conrelid = 'public.records_attorney_access_events'::regclass
  ) then
    alter table public.records_attorney_access_events
      add constraint records_attorney_access_events_owner_user_id_fkey
      foreign key (owner_user_id)
      references auth.users(id)
      on delete cascade
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'records_attorney_access_events_actor_user_id_fkey'
      and conrelid = 'public.records_attorney_access_events'::regclass
  ) then
    alter table public.records_attorney_access_events
      add constraint records_attorney_access_events_actor_user_id_fkey
      foreign key (actor_user_id)
      references auth.users(id)
      on delete set null
      not valid;
  end if;
end
$$;

alter table public.records_attorney_access_events
  validate constraint records_attorney_access_events_owner_user_id_fkey;

alter table public.records_attorney_access_events
  validate constraint records_attorney_access_events_actor_user_id_fkey;

create index if not exists records_attorney_events_actor_idx
  on public.records_attorney_access_events(actor_user_id)
  where actor_user_id is not null;
