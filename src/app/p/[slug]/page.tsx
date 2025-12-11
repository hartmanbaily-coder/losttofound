// src/app/p/[slug]/page.tsx
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import FinderContactForm from "@/components/FinderContactForm";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PublicPetPage({ params }: PageProps) {
  // Next 16: params is a Promise
  const { slug } = await params;

  const { data: pet, error } = await supabaseAdmin
    .from("pets")
    .select(
      `
      id,
      name,
      photo_url,
      photo_url_2,
      photo_url_3,
      description,
      behavior_notes,
      status,
      is_travel_mode,
      travel_city,
      travel_region,
      travel_radius_km,
      travel_notes
    `
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Error loading pet:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-200 px-4">
        <div className="px-4 py-3 rounded-xl border border-red-600/60 bg-slate-900/90 text-sm max-w-sm text-center shadow-lg backdrop-blur-sm">
          <p className="font-semibold mb-1">We could not load this pet.</p>
          <p className="text-[12px] text-red-100/80">
            If this keeps happening, the tag owner may need to update their
            profile.
          </p>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-200 px-4">
        <div className="px-4 py-3 rounded-xl border border-neutral-700 bg-slate-900/90 text-sm max-w-sm text-center shadow-lg backdrop-blur-sm">
          <p className="font-semibold mb-1">No pet found for this tag.</p>
          <p className="text-[12px] text-neutral-400">
            The tag might be inactive or the profile was removed.
          </p>
        </div>
      </div>
    );
  }

  const {
    id,
    name,
    photo_url,
    photo_url_2,
    photo_url_3,
    description,
    behavior_notes,
    status,
    is_travel_mode,
    travel_city,
    travel_region,
    travel_radius_km,
    travel_notes,
  } = pet as {
    id: string;
    name: string;
    photo_url: string | null;
    photo_url_2: string | null;
    photo_url_3: string | null;
    description: string | null;
    behavior_notes: string | null;
    status: "home" | "lost" | "found" | string;
    is_travel_mode: boolean | null;
    travel_city: string | null;
    travel_region: string | null;
    travel_radius_km: number | null;
    travel_notes: string | null;
  };

  const isLost = status === "lost";
  const isFound = status === "found";
  const travelOn = !!is_travel_mode;

  const travelLocationParts = [
    travel_city?.trim() || "",
    travel_region?.trim() || "",
  ].filter(Boolean);
  const travelLocationLabel =
    travelLocationParts.length > 0 ? travelLocationParts.join(", ") : null;

  const photos = [photo_url, photo_url_2, photo_url_3].filter(
    (p): p is string => !!p
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6 rounded-2xl border border-slate-800/80 bg-slate-950/85 px-5 py-6 md:px-8 md:py-8 shadow-2xl backdrop-blur-sm">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="relative h-9 w-9 overflow-hidden rounded-full border border-emerald-300/40 bg-black/80 shadow-sm">
              <Image
                src="/l2f-logo.png"
                alt="LostToFound logo"
                width={36}
                height={36}
                className="h-full w-full object-cover"
                style={{ objectPosition: "50% 30%" }}
                priority
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">
                LostToFound
              </p>
              <h1 className="text-2xl font-semibold text-neutral-50">{name}</h1>
              <p className="text-[11px] text-neutral-400">
                This page is for anyone who finds {name}. Please read the notes
                before you try to help.
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border shadow-sm ${
              isLost
                ? "bg-red-500/20 text-red-100 border-red-500/60"
                : isFound
                ? "bg-yellow-500/20 text-yellow-50 border-yellow-500/60"
                : "bg-emerald-500/20 text-emerald-100 border-emerald-500/60"
            }`}
          >
            {isLost ? "LOST" : isFound ? "FOUND" : "HOME"}
          </span>
        </header>

        {/* Travel mode banner */}
        {travelOn && (
          <section className="rounded-2xl border border-sky-500/60 bg-sky-500/18 px-4 py-3 space-y-1">
            <p className="text-[11px] font-semibold text-sky-50 uppercase tracking-[0.16em]">
              Travel mode
            </p>
            <p className="text-xs text-sky-50/95">
              {name} is traveling with their family
              {travelLocationLabel ? (
                <>
                  {" "}
                  near{" "}
                  <span className="font-semibold">{travelLocationLabel}</span>
                </>
              ) : (
                ""
              )}
              .
            </p>
            {typeof travel_radius_km === "number" && travel_radius_km > 0 && (
              <p className="text-[11px] text-sky-100/90">
                Sightings within about {travel_radius_km} km are the most
                helpful, but any information can still help.
              </p>
            )}
            {travel_notes && (
              <p className="text-[11px] text-sky-50/90 whitespace-pre-wrap leading-relaxed">
                {travel_notes}
              </p>
            )}
          </section>
        )}

        {/* Photo gallery (up to 3) */}
        {photos.length > 0 && (
          <div className="space-y-1">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/85 shadow-md">
              <div
                className={`grid ${
                  photos.length === 1
                    ? "grid-cols-1 h-72 md:h-96"
                    : photos.length === 2
                    ? "grid-cols-2 h-64 md:h-80"
                    : "grid-cols-3 h-56 md:h-72"
                }`}
              >
                {photos.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative overflow-hidden border-r border-slate-950/70 last:border-r-0"
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-full w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${name} photo ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-neutral-500 text-right">
              Tap any photo to view it larger in a new tab.
            </p>
          </div>
        )}

        {/* Safety and behavior */}
        <section className="space-y-3 text-sm">
          {(description || behavior_notes) && (
            <div className="space-y-2 rounded-2xl border border-amber-500/50 bg-amber-500/18 p-4">
              <h2 className="text-sm font-semibold text-amber-50">
                Before you approach {name}
              </h2>
              {description && (
                <p className="text-xs text-amber-50/90 whitespace-pre-wrap leading-relaxed">
                  {description}
                </p>
              )}
              {behavior_notes && (
                <p className="text-[11px] text-amber-100/90 whitespace-pre-wrap leading-relaxed">
                  {behavior_notes}
                </p>
              )}
              <p className="text-[11px] text-amber-200/85">
                Always put your own safety first. If you feel unsafe or the pet
                is near traffic, consider calling local animal control or a non
                emergency police line.
              </p>
            </div>
          )}

          {!description && !behavior_notes && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-[0.16em]">
                Safety
              </h2>
              <p className="text-xs text-neutral-100 mt-1 leading-relaxed">
                Approach slowly and calmly. If {name} seems scared or is near
                traffic, consider contacting local animal services for help.
              </p>
            </div>
          )}
        </section>

        {/* Contact and report section */}
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/85 p-4">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-50">
              Tell the owner about this pet
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Use the form below to let the owner know if you{" "}
              <span className="font-semibold text-neutral-100">
                have {name} with you
              </span>{" "}
              or if you{" "}
              <span className="font-semibold text-neutral-100">
                just saw {name}
              </span>{" "}
              nearby.
            </p>
            {travelOn && travelLocationLabel && (
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                If you can, mention where you saw {name} in relation to{" "}
                <span className="font-semibold text-neutral-100">
                  {travelLocationLabel}
                </span>{" "}
                so the owner can understand how far from their current area the
                sighting was.
              </p>
            )}
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              When you send this form we share your message and the contact
              details you enter with this pet owner so they can reach you. Your
              information is not posted on this page.
            </p>
            <p className="text-[11px] text-neutral-500">
              <a
                href="/privacy"
                className="underline underline-offset-2 text-emerald-300/90"
              >
                Read more about privacy
              </a>
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <FinderContactForm petId={id} petName={name} />
          </div>
        </section>

        <p className="text-[10px] text-neutral-500 text-center leading-relaxed">
          LostToFound provides this page for quick contact only. For
          emergencies, please contact local animal services.
        </p>
      </div>
    </div>
  );
}