// src/app/lost/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PetStatus = "home" | "lost" | "found";

interface LostPet {
  id: string;
  name: string;
  slug: string;
  status: PetStatus | string;
  photo_url: string | null;
  photo_url_2: string | null;
  photo_url_3: string | null;
  description: string | null;
  is_travel_mode: boolean | null;
  travel_city: string | null;
  travel_region: string | null;
  travel_radius_km: number | null;
}

export const revalidate = 30; // small cache so the list stays fresh

export default async function LostPetsPage() {
  const { data, error } = await supabaseAdmin
    .from("pets")
    .select(
      `
      id,
      name,
      slug,
      status,
      photo_url,
      photo_url_2,
      photo_url_3,
      description,
      is_travel_mode,
      travel_city,
      travel_region,
      travel_radius_km
    `
    )
    .eq("status", "lost")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error loading lost pets:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-100 px-4 py-10 flex items-center justify-center">
        <div className="max-w-md rounded-2xl border border-red-600/60 bg-red-900/40 px-5 py-4 text-sm text-center shadow-xl">
          <p className="font-semibold mb-1">We could not load lost pets.</p>
          <p className="text-[12px] text-red-100/80">
            Please refresh the page in a moment. If this keeps happening the
            site owner may need to check the connection.
          </p>
        </div>
      </div>
    );
  }

  const pets = (data as LostPet[]) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-100 px-4 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
            LostToFound
          </p>
          <h1 className="text-3xl font-semibold">Lost pets board</h1>
          <p className="text-sm text-neutral-300 max-w-2xl">
            This page lists pets that are currently marked as lost by their
            owners. If you think you have seen or found one of these pets you
            can open the pet page and send a message to the owner through the
            contact form.
          </p>
        </header>

        {/* List or empty state */}
        {pets.length === 0 ? (
          <div className="rounded-2xl border border-brand-border bg-black/45 px-5 py-6 shadow-xl backdrop-blur-sm">
            <h2 className="text-lg font-medium mb-2">No pets are marked lost</h2>
            <p className="text-sm text-neutral-300">
              There are no pets marked as lost right now. If you scanned a tag
              or followed a link and ended up here the pet may already be home
              or the owner has not updated their status yet.
            </p>
          </div>
        ) : (
          <section className="rounded-2xl border border-brand-border bg-black/35 px-4 py-5 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Pets marked as lost</h2>
              <p className="text-xs text-neutral-400">
                Showing {pets.length} pet{pets.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pets.map((pet) => {
                const photos = [
                  pet.photo_url,
                  pet.photo_url_2,
                  pet.photo_url_3,
                ].filter((p): p is string => !!p);

                const travelOn = !!pet.is_travel_mode;
                const travelLocationParts = [
                  pet.travel_city?.trim() || "",
                  pet.travel_region?.trim() || "",
                ].filter(Boolean);
                const travelLocationLabel =
                  travelLocationParts.length > 0
                    ? travelLocationParts.join(", ")
                    : null;

                return (
                  <article
                    key={pet.id}
                    className="group rounded-2xl border border-brand-border bg-black/50 shadow-md hover:shadow-lg hover:bg-black/60 transition overflow-hidden flex flex-col"
                  >
                    {/* Photo / gallery (clickable to public pet page) */}
                    {photos.length > 0 && (
                      <Link
                        href={`/p/${pet.slug}`}
                        className="relative w-full overflow-hidden bg-black/50 block"
                      >
                        <div
                          className={`grid ${
                            photos.length === 1
                              ? "grid-cols-1 h-40"
                              : photos.length === 2
                              ? "grid-cols-2 h-40"
                              : "grid-cols-3 h-40"
                          }`}
                        >
                          {photos.map((url, idx) => (
                            <div
                              key={idx}
                              className="relative overflow-hidden border-r border-black/40 last:border-r-0"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`${pet.name} photo ${idx + 1}`}
                                className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="absolute bottom-1 right-1 rounded-full bg-black/75 px-2 py-0.5 text-[10px] text-neutral-100 border border-emerald-500/60">
                          Tap to view pet page
                        </div>
                      </Link>
                    )}

                    {/* Content */}
                    <div className="flex flex-col flex-1 px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-base font-semibold text-neutral-50">
                            {pet.name}
                          </h3>
                          {pet.description && (
                            <p className="text-xs text-neutral-300 line-clamp-3">
                              {pet.description}
                            </p>
                          )}
                          {travelOn && travelLocationLabel && (
                            <p className="text-[11px] text-sky-200 flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                              Currently near{" "}
                              <span className="font-medium">
                                {travelLocationLabel}
                              </span>
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="mt-0.5 inline-flex items-center rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-200">
                            LOST
                          </span>
                          {travelOn && (
                            <span className="inline-flex items-center rounded-full border border-sky-500/60 bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-100">
                              Traveling
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 mt-auto flex justify-between items-center gap-2">
                        <Link
                          href={`/p/${pet.slug}`}
                          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-medium text-black hover:bg-emerald-400 transition"
                        >
                          Open pet page
                        </Link>
                        <p className="text-[10px] text-neutral-400 text-right">
                          Contact is handled through the pet page. Your contact
                          details are sent only to the owner.
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Privacy and safety notes */}
        <section className="space-y-1 text-[11px] text-neutral-400 max-w-3xl">
          <p>
            LostToFound does not show owner email, phone, or exact address on
            this page. Messages from finders are delivered through a private
            inbox for each pet owner.
          </p>
          <p>
            For urgent situations or if a pet is near traffic please consider
            contacting local animal services or a non emergency police line for
            help.
          </p>
        </section>
      </div>
    </div>
  );
}