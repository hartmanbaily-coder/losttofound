import { describe, expect, it, vi } from "vitest";
import { deleteRecordsEvidenceForUser } from "@/lib/records/accountDeletion";

const userId = "11111111-1111-4111-8111-111111111111";

function storageClient(initialPaths: string[], removeError: unknown = null) {
  const paths = new Set(initialPaths);
  const list = vi.fn(async (prefix: string, options: { limit: number }) => {
    const prefixWithSlash = `${prefix}/`;
    const children = new Map<string, { id: string | null; name: string }>();

    for (const path of paths) {
      if (!path.startsWith(prefixWithSlash)) continue;
      const remainder = path.slice(prefixWithSlash.length);
      const [name, ...rest] = remainder.split("/");
      if (!name) continue;
      children.set(
        name,
        rest.length > 0
          ? { id: null, name }
          : { id: `object-${path}`, name }
      );
    }

    return {
      data: [...children.values()]
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, options.limit),
      error: null,
    };
  });
  const remove = vi.fn(async (removedPaths: string[]) => {
    if (removeError) return { error: removeError };
    removedPaths.forEach((path) => paths.delete(path));
    return { error: null };
  });

  return {
    paths,
    list,
    remove,
    supabase: {
      storage: {
        from: () => ({ list, remove }),
      },
    },
  };
}

describe("account evidence deletion", () => {
  it("recursively removes every object under the authenticated user's prefix", async () => {
    const storage = storageClient([
      `${userId}/case-a/evidence-a/document.pdf`,
      `${userId}/case-a/evidence-b/photo.jpg`,
      `${userId}/case-b/evidence-c/notes.txt`,
      "22222222-2222-4222-8222-222222222222/case/evidence/keep.pdf",
    ]);

    const result = await deleteRecordsEvidenceForUser({
      supabase: storage.supabase,
      userId,
      bucket: "records-evidence",
    });

    expect(result).toEqual({ ok: true, deletedObjects: 3 });
    expect([...storage.paths]).toEqual([
      "22222222-2222-4222-8222-222222222222/case/evidence/keep.pdf",
    ]);
  });

  it("restarts listing at offset zero so deletion does not skip large folders", async () => {
    const storage = storageClient(
      Array.from({ length: 1001 }, (_, index) => `${userId}/case/evidence/file-${index}.txt`)
    );

    const result = await deleteRecordsEvidenceForUser({
      supabase: storage.supabase,
      userId,
    });

    expect(result).toEqual({ ok: true, deletedObjects: 1001 });
    expect(storage.paths.size).toBe(0);
    expect(storage.remove).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the Storage API cannot remove an object", async () => {
    const storage = storageClient(
      [`${userId}/case/evidence/document.pdf`],
      new Error("storage unavailable")
    );

    const result = await deleteRecordsEvidenceForUser({
      supabase: storage.supabase,
      userId,
    });

    expect(result).toEqual({
      ok: false,
      error: "Unable to remove all private evidence files for this account.",
    });
  });

  it("rejects an invalid user id before addressing Storage", async () => {
    const storage = storageClient([]);

    const result = await deleteRecordsEvidenceForUser({
      supabase: storage.supabase,
      userId: "../someone-else",
    });

    expect(result).toEqual({ ok: false, error: "Account storage path is invalid." });
    expect(storage.list).not.toHaveBeenCalled();
  });
});
