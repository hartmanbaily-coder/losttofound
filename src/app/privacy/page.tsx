import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-900 text-neutral-100 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-brand-border bg-black/60 px-5 py-6 shadow-xl backdrop-blur-sm">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
            LostToFound
          </p>
          <h1 className="text-2xl font-semibold text-neutral-50">
            Privacy
          </h1>
          <p className="text-sm text-neutral-300">
            This page explains how LostToFound handles information about you
            and your pets when you use this site.
          </p>
        </header>

        <section className="space-y-2 text-sm text-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-100">
            What information is stored
          </h2>
          <p>
            When you create an account LostToFound stores your email address
            so you can sign in and so the system can send you messages that
            relate to your pets and your plan.
          </p>
          <p>
            When you add a pet LostToFound stores the pet name, status, photos,
            and any notes you add about description or behavior. You choose what
            to write and which photos to upload.
          </p>
          <p>
            When someone fills out the finder form on a public pet page the
            message and contact details they enter are stored as a private
            record that is only visible to the pet owner when signed in.
          </p>
        </section>

        <section className="space-y-2 text-sm text-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-100">
            What is shown in public
          </h2>
          <p>
            Public pet pages and the lost pets board show the pet name,
            photos, general notes, and current status. They do not show the
            owner name, email address, phone number, or exact home address.
          </p>
          <p>
            Messages from finders are sent through the site so the owner can
            see them in the dashboard. The contact details that a finder
            chooses to share are only passed to that pet owner so they can
            respond.
          </p>
        </section>

        <section className="space-y-2 text-sm text-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-100">
            How data is stored
          </h2>
          <p>
            LostToFound uses Supabase for sign in, database storage, and file
            storage. Access rules are set so that each signed in user can only
            see their own pets, messages, and billing details.
          </p>
          <p>
            Payments are handled by Stripe. Stripe stores card details and
            billing information and shares back only the data that is needed
            to know whether your household has an active Plus plan.
          </p>
        </section>

        <section className="space-y-2 text-sm text-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-100">
            Analytics and logs
          </h2>
          <p>
            Basic logs may include things like the page that was visited, the
            time of the request, and a technical identifier for your browser.
            They are used to keep the site stable and to understand general
            usage. They are not meant to build marketing profiles.
          </p>
        </section>

        <section className="space-y-2 text-sm text-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-100">
            Your choices
          </h2>
          <p>
            You can remove a pet at any time from the dashboard and you can
            change the photos or notes that appear on a public page. If you
            stop using the site you may contact support to request removal of
            your account data where that is possible.
          </p>
        </section>

        <section className="space-y-2 text-sm text-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-100">
            Contact
          </h2>
          <p>
            If you have questions about privacy or need help with your data
            you can contact the site owner using the contact details posted
            on the main LostToFound site or through support links in your
            dashboard.
          </p>
        </section>

        <p className="text-xs text-neutral-500">
          
        </p>

        <div className="pt-2">
          <Link
            href="/"
            className="text-xs text-emerald-300 underline underline-offset-2"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}