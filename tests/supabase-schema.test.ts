import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("database/supabase/production_schema.sql", "utf8");

describe("Supabase production schema", () => {
  it("binds child support payments to the matching support order case", () => {
    expect(schema).not.toContain("o.case_id = case_id");
    expect(schema).toContain("o.id = records_child_support_payments.child_support_order_id");
    expect(schema).toContain("o.case_id = records_child_support_payments.case_id");
  });
});
