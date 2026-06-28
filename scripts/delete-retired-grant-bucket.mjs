import { createClient } from "@supabase/supabase-js";

const expectedProjectRef = "cieuilbpnwuvnrxrlczj";
const retiredBucketId = "grant-documents";
const evidenceBucketId = "records-evidence";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function projectRefFromUrl(value) {
  try {
    const host = new URL(value).hostname;
    if (!host.endsWith(".supabase.co")) return "";
    return host.split(".")[0] || "";
  } catch {
    return "";
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmation = process.env.DELETE_RETIRED_GRANT_BUCKET_CONFIRM;

if (!supabaseUrl || !serviceRoleKey) {
  fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before cleanup.");
}

if (projectRefFromUrl(supabaseUrl) !== expectedProjectRef) {
  fail(`Refusing to run outside production project ${expectedProjectRef}.`);
}

if (confirmation !== retiredBucketId) {
  fail(`Set DELETE_RETIRED_GRANT_BUCKET_CONFIRM=${retiredBucketId} to delete the retired bucket.`);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: buckets, error: listBucketsError } = await supabase.storage.listBuckets();
if (listBucketsError) {
  fail(`Unable to list Storage buckets: ${listBucketsError.message}`);
}

const bucket = (buckets || []).find((item) => item.id === retiredBucketId || item.name === retiredBucketId);
if (!bucket) {
  console.log(`Retired Storage bucket ${retiredBucketId} is already absent.`);
  process.exit(0);
}

if (bucket.id === evidenceBucketId || bucket.name === evidenceBucketId) {
  fail(`Refusing to delete active evidence bucket ${evidenceBucketId}.`);
}

if (bucket.id !== retiredBucketId || bucket.name !== retiredBucketId) {
  fail(`Refusing to delete unexpected bucket id/name: ${bucket.id}/${bucket.name}.`);
}

if (bucket.public) {
  fail(`Refusing to delete ${retiredBucketId} because it is unexpectedly public.`);
}

const { data: rootObjects, error: listObjectsError } = await supabase.storage
  .from(retiredBucketId)
  .list("", { limit: 1 });
if (listObjectsError) {
  fail(`Unable to inspect ${retiredBucketId}: ${listObjectsError.message}`);
}

if ((rootObjects || []).length > 0) {
  fail(`Refusing to delete ${retiredBucketId} because it is not empty.`);
}

const { error: deleteError } = await supabase.storage.deleteBucket(retiredBucketId);
if (deleteError) {
  fail(`Unable to delete ${retiredBucketId}: ${deleteError.message}`);
}

console.log(`Deleted retired private empty Storage bucket ${retiredBucketId}.`);
