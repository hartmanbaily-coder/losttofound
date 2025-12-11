// src/app/poster/[slug]/page.tsx
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PrintPosterButton from "@/components/PrintPosterButton";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PosterPage({ params }: PageProps) {
  // Next 16: params is a Promise
  const { slug } = await params;

  const { data: pet, error } = await supabaseAdmin
    .from("pets")
    .select(
      `
      name,
      photo_url,
      photo_url_2,
      photo_url_3,
      contact_phone_primary,
      contact_phone_backup
    `
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Error loading pet for poster:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-200 px-4">
        <div className="px-4 py-3 rounded-xl border border-red-600/60 bg-neutral-950 text-sm max-w-sm text-center shadow-lg">
          <p className="font-semibold mb-1">
            We could not load this pet for a poster.
          </p>
          <p className="text-[12px] text-red-100/80">
            If this keeps happening the owner may need to update their profile.
          </p>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-200 px-4">
        <div className="px-4 py-3 rounded-xl border border-neutral-700 bg-neutral-950 text-sm max-w-sm text-center shadow-lg">
          <p className="font-semibold mb-1">No pet found for this poster.</p>
          <p className="text-[12px] text-neutral-400">
            The profile might be inactive or removed.
          </p>
        </div>
      </div>
    );
  }

  const {
    name,
    photo_url,
    photo_url_2,
    photo_url_3,
    contact_phone_primary,
    contact_phone_backup,
  } = pet as {
    name: string;
    photo_url: string | null;
    photo_url_2: string | null;
    photo_url_3: string | null;
    contact_phone_primary: string | null;
    contact_phone_backup: string | null;
  };

  const photos = [photo_url, photo_url_2, photo_url_3].filter(
    (p): p is string => !!p
  );
  const primaryPhoto = photos[0] ?? null;

  const ownerPhone =
    contact_phone_primary?.trim() || contact_phone_backup?.trim() || null;

  return (
    <div className="min-h-screen bg-neutral-300 flex flex-col items-center justify-center px-4 py-6">
      {/* Top action row (hidden when printing) */}
      <div className="w-full max-w-2xl flex justify-end mb-2 print:hidden">
        <PrintPosterButton />
      </div>

      {/* 8.5x11-ish printable area (scaled by browser print) */}
      <div className="w-full max-w-2xl bg-white text-neutral-900 border border-neutral-400 shadow-xl p-6 space-y-6">
        {/* LOST PET heading */}
        <header className="text-center space-y-2">
          <p className="text-xs tracking-[0.3em] uppercase text-red-700">
            LostToFound
          </p>
          <h1 className="text-4xl font-extrabold tracking-wide text-red-700">
            LOST PET
          </h1>
          <h2 className="text-3xl font-bold mt-1">{name}</h2>
        </header>

        {/* Photo */}
        {primaryPhoto && (
          <div className="flex justify-center">
            <div className="w-full max-w-md h-72 border-4 border-neutral-900 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={primaryPhoto}
                alt={`${name} photo`}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}

        {!primaryPhoto && (
          <div className="flex justify-center">
            <div className="w-full max-w-md h-72 border-4 border-neutral-900 flex items-center justify-center">
              <p className="text-sm text-neutral-600">
                Add a photo on your dashboard to show it here.
              </p>
            </div>
          </div>
        )}

        {/* Owner phone */}
        <section className="pt-2 space-y-2 text-center">
          <p className="text-lg font-semibold">
            If you see or find this pet, please call:
          </p>
          {ownerPhone ? (
            <p className="text-3xl font-extrabold tracking-wide">
              {ownerPhone}
            </p>
          ) : (
            <>
              <div className="mx-auto w-64 h-10 border-b-2 border-neutral-900" />
              <p className="text-[11px] text-neutral-600">
                Write a phone number here before posting this flyer.
              </p>
            </>
          )}
        </section>

        {/* Tear-off area cue */}
        <footer className="pt-4 border-t border-dashed border-neutral-400 text-center text-[11px] text-neutral-600">
          Cut along the line for tear offs or post as a full sheet.
        </footer>
      </div>
    </div>
  );
}