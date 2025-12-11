// src/app/terms/page.tsx
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-100 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="rounded-2xl border border-brand-border bg-black/55 px-5 py-6 text-sm text-neutral-100 shadow-xl backdrop-blur-sm">
          <h1 className="text-2xl font-semibold mb-2">Terms of use</h1>
          <p className="text-xs text-neutral-400 mb-4">
            Last updated {new Date().getFullYear()}
          </p>

          <p className="mb-3 text-sm text-neutral-200">
            LostToFound is a simple tool to help pet owners share information
            about a missing pet and receive messages from people who might have
            seen or found that pet. By using this site, you agree to these
            terms.
          </p>

          <h2 className="mt-4 mb-1 text-sm font-semibold text-neutral-50">
            1. Not an emergency service
          </h2>
          <p className="mb-3 text-sm text-neutral-200">
            LostToFound is not an emergency service and does not respond to
            urgent requests. If a person or animal is in immediate danger you
            should contact local animal control, a veterinarian, or emergency
            services directly.
          </p>

          <h2 className="mt-4 mb-1 text-sm font-semibold text-neutral-50">
            2. Your account and information
          </h2>
          <p className="mb-3 text-sm text-neutral-200">
            You are responsible for the accuracy of the information you add
            about your pets and for keeping your login secure. Do not post
            abusive, threatening, or illegal content. LostToFound may remove
            content or limit access if it appears unsafe or abusive.
          </p>

          <h2 className="mt-4 mb-1 text-sm font-semibold text-neutral-50">
            3. Finder messages
          </h2>
          <p className="mb-3 text-sm text-neutral-200">
            Messages that finders send through a pet page are delivered only to
            the pet owner&apos;s dashboard and are not public. You are
            responsible for how you choose to respond to those messages.
          </p>

          <h2 className="mt-4 mb-1 text-sm font-semibold text-neutral-50">
            4. No guarantee of outcome
          </h2>
          <p className="mb-3 text-sm text-neutral-200">
            LostToFound cannot guarantee that a pet will be found or returned.
            The service is a communication tool only and is provided on an
            “as-is” basis without warranties.
          </p>

          <h2 className="mt-4 mb-1 text-sm font-semibold text-neutral-50">
            5. Changes to these terms
          </h2>
          <p className="mb-3 text-sm text-neutral-200">
            These terms may change over time. If they change in a major way, a
            notice may be posted on the site. Your continued use of the service
            after changes means you accept the updated terms.
          </p>

          <h2 className="mt-4 mb-1 text-sm font-semibold text-neutral-50">
            6. Contact
          </h2>
          <p className="mb-1 text-sm text-neutral-200">
            If you have questions about these terms, you can reach the site
            owner using the contact details listed on the{" "}
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