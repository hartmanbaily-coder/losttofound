-- Lost to Found Records production schema baseline.
--
-- Keep this file aligned with the applied Supabase migrations documented in
-- PRODUCTION_PREPAREDNESS.md and DEPLOYMENT_NOTES.md.
--
-- 2026 Supabase note: records data is intentionally server-mediated through
-- Next.js API routes and the Supabase service role. Do not grant direct `anon`
-- or `authenticated` table access unless a specific browser-side data path is
-- designed and reviewed.

create extension if not exists pgcrypto;

create table if not exists public.records_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records_matters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_name text not null,
  court_or_order_nickname text,
  court_name text,
  order_date date,
  effective_start_date date,
  effective_end_date date,
  child_display_labels jsonb not null default '[]'::jsonb,
  user_role_label text not null,
  other_parent_label text not null,
  default_exchange_location text,
  timezone text not null default 'UTC',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records_exchange_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.records_matters(id) on delete cascade,
  rule_name text not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  ordered_exchange_time time not null,
  direction text not null check (direction in ('other_parent_to_me', 'me_to_other_parent')),
  location text,
  effective_start_date date not null,
  effective_end_date date,
  order_provision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.records_matters(id) on delete cascade,
  custody_exchange_rule_id uuid references public.records_exchange_rules(id) on delete set null,
  exception_date date not null,
  ordered_exchange_time time,
  status text not null check (status in ('rescheduled', 'canceled', 'added')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records_custody_day_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.records_matters(id) on delete cascade,
  custody_date date not null,
  caregiver_label text not null,
  color text not null,
  starts_at time,
  ends_at time,
  exchange_time time,
  exchange_direction text check (exchange_direction in ('other_parent_to_me', 'me_to_other_parent')),
  exchange_location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, case_id, custody_date)
);

create table if not exists public.records_exchange_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.records_matters(id) on delete cascade,
  custody_exchange_rule_id uuid references public.records_exchange_rules(id) on delete set null,
  ordered_exchange_at timestamptz not null,
  actual_exchange_at timestamptz,
  direction text not null check (direction in ('other_parent_to_me', 'me_to_other_parent')),
  status text not null,
  location text,
  reason_given text,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  witnesses text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records_date_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.records_matters(id) on delete cascade,
  note_date date not null,
  note_time time,
  category text not null,
  title text not null,
  body text not null,
  tags jsonb not null default '[]'::jsonb,
  include_in_reports boolean not null default true,
  related_exchange_id uuid references public.records_exchange_logs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records_evidence_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.records_matters(id) on delete cascade,
  related_exchange_id uuid references public.records_exchange_logs(id) on delete set null,
  related_note_id uuid references public.records_date_notes(id) on delete set null,
  original_file_name text not null,
  stored_file_name text not null,
  file_type text not null,
  file_size bigint not null check (file_size > 0),
  uploaded_at timestamptz not null default now(),
  evidence_date date,
  description text,
  tags jsonb not null default '[]'::jsonb,
  include_in_reports boolean not null default true,
  malware_scan_status text not null default 'pending'
    check (malware_scan_status in ('pending', 'clean', 'blocked', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records_child_support_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.records_matters(id) on delete cascade,
  order_nickname text not null,
  ordered_amount numeric(12,2) not null check (ordered_amount >= 0),
  currency char(3) not null default 'USD',
  payment_frequency text not null,
  due_day_or_schedule text not null,
  effective_start_date date not null,
  effective_end_date date,
  payer_label text not null,
  recipient_label text not null,
  payment_method_expected text,
  agency_or_case_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records_child_support_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.records_matters(id) on delete cascade,
  child_support_order_id uuid not null references public.records_child_support_orders(id) on delete restrict,
  due_date date not null,
  amount_due numeric(12,2) not null check (amount_due >= 0),
  amount_paid numeric(12,2) not null check (amount_paid >= 0),
  payment_date date,
  payment_status text not null,
  payment_method text not null,
  reference_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records_expense_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references public.records_matters(id) on delete cascade,
  expense_date date not null,
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'USD',
  paid_by_label text not null,
  reimbursement_requested boolean not null default false,
  reimbursement_due_date date,
  amount_reimbursed numeric(12,2) check (amount_reimbursed >= 0),
  reimbursement_date date,
  reimbursement_status text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.records_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references public.records_matters(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata_summary text not null,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.records_case_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_key text not null,
  dataset jsonb not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, case_key)
);

create index if not exists records_matters_user_idx on public.records_matters(user_id);
create index if not exists records_exchange_rules_user_idx on public.records_exchange_rules(user_id);
create index if not exists records_exchange_rules_case_idx on public.records_exchange_rules(case_id);
create index if not exists records_schedule_exceptions_user_idx on public.records_schedule_exceptions(user_id);
create index if not exists records_schedule_exceptions_case_idx on public.records_schedule_exceptions(case_id);
create index if not exists records_schedule_exceptions_rule_idx on public.records_schedule_exceptions(custody_exchange_rule_id);
create index if not exists records_custody_days_case_idx on public.records_custody_day_assignments(case_id);
create index if not exists records_exchange_logs_case_date_idx on public.records_exchange_logs(case_id, ordered_exchange_at);
create index if not exists records_exchange_logs_user_idx on public.records_exchange_logs(user_id);
create index if not exists records_exchange_logs_rule_idx on public.records_exchange_logs(custody_exchange_rule_id);
create index if not exists records_notes_case_date_idx on public.records_date_notes(case_id, note_date);
create index if not exists records_notes_user_idx on public.records_date_notes(user_id);
create index if not exists records_notes_related_exchange_idx on public.records_date_notes(related_exchange_id);
create index if not exists records_evidence_case_date_idx on public.records_evidence_items(case_id, evidence_date);
create index if not exists records_evidence_user_idx on public.records_evidence_items(user_id);
create index if not exists records_evidence_related_exchange_idx on public.records_evidence_items(related_exchange_id);
create index if not exists records_evidence_related_note_idx on public.records_evidence_items(related_note_id);
create index if not exists records_support_orders_user_idx on public.records_child_support_orders(user_id);
create index if not exists records_support_orders_case_idx on public.records_child_support_orders(case_id);
create index if not exists records_support_payments_case_due_idx on public.records_child_support_payments(case_id, due_date);
create index if not exists records_support_payments_user_idx on public.records_child_support_payments(user_id);
create index if not exists records_support_payments_order_idx on public.records_child_support_payments(child_support_order_id);
create index if not exists records_expenses_case_date_idx on public.records_expense_items(case_id, expense_date);
create index if not exists records_expenses_user_idx on public.records_expense_items(user_id);
create index if not exists records_audit_case_created_idx on public.records_audit_logs(case_id, created_at desc);
create index if not exists records_audit_user_idx on public.records_audit_logs(user_id);
create index if not exists records_case_snapshots_user_idx on public.records_case_snapshots(user_id);

alter table public.records_profiles enable row level security;
alter table public.records_matters enable row level security;
alter table public.records_exchange_rules enable row level security;
alter table public.records_schedule_exceptions enable row level security;
alter table public.records_custody_day_assignments enable row level security;
alter table public.records_exchange_logs enable row level security;
alter table public.records_date_notes enable row level security;
alter table public.records_evidence_items enable row level security;
alter table public.records_child_support_orders enable row level security;
alter table public.records_child_support_payments enable row level security;
alter table public.records_expense_items enable row level security;
alter table public.records_audit_logs enable row level security;
alter table public.records_case_snapshots enable row level security;

revoke all on
  public.records_profiles,
  public.records_matters,
  public.records_exchange_rules,
  public.records_schedule_exceptions,
  public.records_custody_day_assignments,
  public.records_exchange_logs,
  public.records_date_notes,
  public.records_evidence_items,
  public.records_child_support_orders,
  public.records_child_support_payments,
  public.records_expense_items,
  public.records_case_snapshots
from anon, authenticated;

revoke all on public.records_audit_logs from anon, authenticated;

drop policy if exists "owners_select_profiles" on public.records_profiles;
drop policy if exists "owners_write_profiles" on public.records_profiles;
drop policy if exists "owners_insert_profiles" on public.records_profiles;
drop policy if exists "owners_update_profiles" on public.records_profiles;
drop policy if exists "owners_delete_profiles" on public.records_profiles;
drop policy if exists "owners_write_matters" on public.records_matters;
drop policy if exists "owners_write_exchange_rules" on public.records_exchange_rules;
drop policy if exists "owners_write_schedule_exceptions" on public.records_schedule_exceptions;
drop policy if exists "owners_write_custody_days" on public.records_custody_day_assignments;
drop policy if exists "owners_write_exchange_logs" on public.records_exchange_logs;
drop policy if exists "owners_write_date_notes" on public.records_date_notes;
drop policy if exists "owners_write_evidence_items" on public.records_evidence_items;
drop policy if exists "owners_write_support_orders" on public.records_child_support_orders;
drop policy if exists "owners_write_support_payments" on public.records_child_support_payments;
drop policy if exists "owners_write_expenses" on public.records_expense_items;
drop policy if exists "owners_select_audit_logs" on public.records_audit_logs;
drop policy if exists "owners_insert_audit_logs" on public.records_audit_logs;
drop policy if exists "owners_write_case_snapshots" on public.records_case_snapshots;

create policy "owners_select_profiles" on public.records_profiles
  for select to authenticated using ((select auth.uid()) is not null and user_id = (select auth.uid()));
create policy "owners_insert_profiles" on public.records_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "owners_update_profiles" on public.records_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "owners_delete_profiles" on public.records_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "owners_write_matters" on public.records_matters
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "owners_write_exchange_rules" on public.records_exchange_rules
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  );

create policy "owners_write_schedule_exceptions" on public.records_schedule_exceptions
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  );

create policy "owners_write_custody_days" on public.records_custody_day_assignments
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  );

create policy "owners_write_exchange_logs" on public.records_exchange_logs
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  );

create policy "owners_write_date_notes" on public.records_date_notes
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  );

create policy "owners_write_evidence_items" on public.records_evidence_items
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  );

create policy "owners_write_support_orders" on public.records_child_support_orders
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  );

create policy "owners_write_support_payments" on public.records_child_support_payments
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.records_child_support_orders o
      where
        o.id = records_child_support_payments.child_support_order_id
        and o.user_id = (select auth.uid())
        and o.case_id = records_child_support_payments.case_id
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.records_child_support_orders o
      where
        o.id = records_child_support_payments.child_support_order_id
        and o.user_id = (select auth.uid())
        and o.case_id = records_child_support_payments.case_id
    )
  );

create policy "owners_write_expenses" on public.records_expense_items
  for all to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.records_matters m
      where m.id = case_id and m.user_id = (select auth.uid())
    )
  );

create policy "owners_select_audit_logs" on public.records_audit_logs
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (
      case_id is null
      or exists (
        select 1 from public.records_matters m
        where m.id = case_id and m.user_id = (select auth.uid())
      )
    )
  );
create policy "owners_insert_audit_logs" on public.records_audit_logs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      case_id is null
      or exists (
        select 1 from public.records_matters m
        where m.id = case_id and m.user_id = (select auth.uid())
      )
    )
  );

create policy "owners_write_case_snapshots" on public.records_case_snapshots
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'records-evidence',
  'records-evidence',
  false,
  10485760,
  array['application/pdf','image/png','image/jpeg','image/heic','image/heif','text/plain','text/csv']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "records evidence owner read" on storage.objects;
drop policy if exists "records evidence owner insert" on storage.objects;
drop policy if exists "records evidence owner update" on storage.objects;
drop policy if exists "records evidence owner delete" on storage.objects;

create policy "records evidence owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'records-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "records evidence owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'records-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "records evidence owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'records-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'records-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "records evidence owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'records-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
