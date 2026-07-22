import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("database/supabase/production_schema.sql", "utf8");
const accountDeletionMigration = readFileSync(
  "supabase/migrations/20260722161808_harden_account_deletion_cascades.sql",
  "utf8"
);

describe("Supabase production schema", () => {
  it("binds child support payments to the matching support order case", () => {
    expect(schema).not.toContain("o.case_id = case_id");
    expect(schema).toContain("o.id = records_child_support_payments.child_support_order_id");
    expect(schema).toContain("o.case_id = records_child_support_payments.case_id");
  });

  it("keeps evidence storage server-mediated instead of direct authenticated access", () => {
    expect(schema).toContain("public = false");
    expect(schema).toContain('drop policy if exists "records evidence owner insert"');
    expect(schema).not.toContain('create policy "records evidence owner read"');
    expect(schema).not.toContain('create policy "records evidence owner insert"');
    expect(schema).not.toContain('create policy "records evidence owner update"');
    expect(schema).not.toContain('create policy "records evidence owner delete"');
  });

  it("cascades every active database dependency during Auth user deletion", () => {
    expect(schema).toContain(
      "child_support_order_id uuid not null references public.records_child_support_orders(id) on delete cascade"
    );
    expect(accountDeletionMigration).toContain(
      "records_attorney_access_events_owner_user_id_fkey"
    );
    expect(accountDeletionMigration).toContain("references auth.users(id)\n      on delete cascade");
    expect(accountDeletionMigration).toContain(
      "records_attorney_access_events_actor_user_id_fkey"
    );
    expect(accountDeletionMigration).toContain("references auth.users(id)\n      on delete set null");
    expect(accountDeletionMigration).toContain("records_attorney_events_actor_idx");
  });
});
