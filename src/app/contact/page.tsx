// src/app/contact/page.tsx
import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-100 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="rounded-2xl border border-brand-border bg-black/55 px-5 py-6 text-sm text-neutral-100 shadow-xl backdrop-blur-sm">
          <h1 className="text-2xl font-semibold mb-2">Contact</h1>
          <p className="text-xs text-neutral-400 mb-4">
            LostToFound is run by a single builder. Response times may vary,
            but questions and feedback are welcome.
          </p>

          <h2 className="mt-2 mb-1 text-sm font-semibold text-neutral-50">
            Email
          </h2>
          <p className="mb-3 text-sm text-neutral-200">
            For questions about the site, billing, bugs, or ideas for new
            features you can email:
          </p>
          <p className="mb-4 text-sm">
            <a
              href="mailto:listhaushelp@outlook.com"
              className="font-mono text-emerald-300 underline underline-offset-2"
            >
              listhaushelp@outlook.com
            </a>
          </p>

          <h2 className="mt-4 mb-1 text-sm font-semibold text-neutral-50">
            Lost pets and urgent situations
          </h2>
          <p className="mb-3 text-sm text-neutral-200">
            If you have a lost pet right now, please use your{" "}
            <Link
              href="/dashboard"
              className="underline underline-offset-2 text-emerald-300"
            >
              dashboard
            </Link>{" "}
            and your pet&apos;s public page to share updates and receive
            messages. This inbox is not monitored as an emergency line.
          </p>
          <p className="mb-3 text-sm text-neutral-200">
            If a person or animal is in immediate danger, contact local animal
            control, a veterinarian, or emergency services directly instead of
            waiting for an email response.
          </p>

          <h2 className="mt-4 mb-1 text-sm font-semibold text-neutral-50">
            Privacy
          </h2>
          <p className="mb-1 text-sm text-neutral-200">
            Emails are kept for support and troubleshooting only. For more
            details on how information is handled, see the{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 text-emerald-300"
            >
              privacy page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}