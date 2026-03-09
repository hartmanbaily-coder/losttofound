import Link from "next/link";
import Image from "next/image";

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-white px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
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
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                LostToFound
              </p>
              <h1 className="text-2xl font-semibold">Billing</h1>
            </div>
          </div>
          <p className="text-sm text-gray-300">
            LostToFound no longer requires a paid plan. All dashboard features
            are available to every account.
          </p>
        </header>

        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <p className="font-medium">All features unlocked</p>
          <p className="mt-1 text-xs text-emerald-200">
            Unlimited pets, full sightings history, travel mode, lost poster
            tools, and extra contact fields are now included at no cost.
          </p>
        </section>

        <section className="rounded-2xl border border-brand-border bg-black/40 p-4 space-y-3 text-sm">
          <h2 className="text-sm font-semibold text-neutral-100">
            Order QR tags from LostToFound
          </h2>
          <p className="text-xs text-gray-300">
            You can use each pet&apos;s public link on its own, or place that
            link on a QR tag for a collar. When someone scans the tag it opens
            the same pet page from your dashboard.
          </p>
          <div className="pt-1 flex flex-wrap gap-2">
            <a
              href="https://amzn.to/4oNgs5d"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400"
            >
              Order QR tags on Amazon
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-neutral-100 hover:border-neutral-400"
            >
              Back to dashboard
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
