// src/app/page.tsx
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-100 px-4 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero */}
        <section className="space-y-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-3">
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
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                LostToFound
              </p>
            </div>

            <h1 className="text-3xl md:text-4xl font-semibold leading-tight text-neutral-50">
              A lost pet dashboard for real world chaos.
            </h1>
            <p className="text-sm md:text-base text-neutral-300">
              LostToFound gives you a simple dashboard for each pet, a public
              page you can share in Facebook groups, and a sightings log when
              people report that they have your pet or just saw your pet.
            </p>
            <p className="text-sm md:text-base text-neutral-300">
              Start with one free pet profile. Add optional QR tags and a Plus
              plan later if you need unlimited pets and more tools.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 transition-colors"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-100 hover:border-neutral-400 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/lost"
              className="rounded-full border border-emerald-500/70 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-100 transition-colors"
            >
              View lost pets board
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="rounded-2xl border border-brand-border bg-black/45 px-4 py-4 text-sm text-neutral-200 shadow-xl backdrop-blur-sm">
          <h2 className="mb-3 text-sm font-semibold text-neutral-100">
            How LostToFound works
          </h2>
          <ol className="space-y-2 list-decimal list-inside">
            <li>
              Create your pet&apos;s profile and mark them as home, lost, or
              found.
            </li>
            <li>
              Share the public link in Facebook groups, texts, or on posters, or
              put it on a QR tag on their collar.
            </li>
            <li>
              When someone scans the code or opens the link, they see a calm
              safety page and can report if they have your pet or just saw your
              pet.
            </li>
            <li>
              Those reports show up in your dashboard as a sightings timeline so
              you can track what has been happening.
            </li>
          </ol>
        </section>

        {/* Free vs Plus */}
        <section className="rounded-2xl border border-brand-border bg-black/45 px-4 py-4 text-sm text-neutral-200 space-y-2 shadow-xl backdrop-blur-sm">
          <h2 className="text-sm font-semibold text-neutral-100">
            Free now, Plus when you need it
          </h2>
          <p className="text-sm text-neutral-200">
            The core tools stay free for a single pet: a profile, public page,
            and basic sightings. Upgrade your household to Plus when you need
            unlimited pets and deeper tools.
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-neutral-300">
            <li>Unlimited pets on one household account with Plus.</li>
            <li>Full sightings history for every pet on Plus.</li>
            <li>Travel mode tools for trips.</li>
            <li>Lost poster generator coming later.</li>
            <li>Extra contact options coming later.</li>
          </ul>
          <p className="text-xs text-neutral-400 mt-2">
            You can also order QR tags from LostToFound if you want a physical
            tag linked to your online dashboard.
          </p>
        </section>
      </div>
    </div>
  );
}