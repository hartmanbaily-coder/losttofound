import Link from "next/link";

const lastUpdated = "June 16, 2026";

const sections = [
  {
    title: "Records workspace",
    body: [
      "Lost to Found Records is an MVP for adults organizing custody, parenting-time, child support, expense, evidence, and family-court documentation.",
      "The service is for factual organization and recordkeeping. It does not decide legal rights, verify legal claims, predict outcomes, or replace professional advice.",
      "The MVP may change as production controls, storage, exports, deletion workflows, and security operations mature.",
    ],
  },
  {
    title: "No legal advice",
    body: [
      "The service does not provide legal advice, court strategy, legal determinations, filing advice, or legal representation.",
      "Users should consult a qualified attorney about court orders, evidence handling, filing requirements, child support obligations, and their specific situation.",
      "Generated summaries, exports, calendars, notes, and evidence indexes are user organization tools, not legal findings.",
    ],
  },
  {
    title: "User responsibility",
    body: [
      "Users are responsible for the accuracy, completeness, legality, and appropriateness of records they enter, upload, export, or share.",
      "Users should avoid entering Social Security numbers, full bank account numbers, full card numbers, bank login credentials, unrelated third-party details, or unnecessary medical detail.",
      "Users are responsible for protecting downloaded files and exports after they leave the app's protected storage.",
    ],
  },
  {
    title: "Evidence and admissibility",
    body: [
      "The service does not guarantee that any note, file, photo, receipt, export, report, calendar, or evidence item will be accepted or relied on by a court, agency, mediator, attorney, or other third party.",
      "Users are responsible for preserving originals, following applicable court rules, and avoiding edits that could affect record integrity.",
      "The service may reject files by type, size, malware scan result, or security policy.",
    ],
  },
  {
    title: "Adult use and safety",
    body: [
      "The service is intended for adult users. It does not provide child accounts, child profiles, public profiles, or child-facing social features.",
      "The service is not an emergency service, crisis service, law enforcement tool, safety-response provider, or supervised exchange service.",
      "Users should contact local emergency services, law enforcement, legal counsel, or qualified support professionals when appropriate.",
    ],
  },
  {
    title: "Payments and financial records",
    body: [
      "Child support and expense tools are for documentation only.",
      "The service does not process payments, collect bank login credentials, scrape bank accounts, store full account/card numbers, or verify that a payment legally satisfies an obligation.",
      "Users are responsible for confirming payment status with their bank, payment provider, agency, court, attorney, or other appropriate source.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "Do not use the service to harass, stalk, threaten, impersonate, surveil, dox, or unlawfully disclose another person's information.",
      "Do not upload malware, exploit code, illegal content, or content you do not have the right to store or use.",
      "Do not attempt to bypass authorization, access another user's records, disrupt the service, or reverse engineer private security controls.",
    ],
  },
  {
    title: "Accounts and availability",
    body: [
      "Users are responsible for keeping account credentials secure and promptly reporting suspected unauthorized access.",
      "Production may require multi-factor authentication, stronger password rules, session controls, and account verification before accepting real records.",
      "The service may be unavailable during maintenance, security events, vendor outages, or production readiness work.",
    ],
  },
  {
    title: "Deletion and retention",
    body: [
      "Users may be offered export, case deletion, evidence deletion, and account deletion controls as production workflows are finalized.",
      "Deleted records may remain in encrypted backups until those backups expire under the retention schedule.",
      "Deletion may be delayed or limited when legally required, when needed for security investigation, or when a valid hold applies.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Lost to Found Records
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Terms of Use Draft
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Last updated {lastUpdated}. These draft terms describe the intended
          use boundaries for the records workspace and should be reviewed by
          qualified counsel before production launch.
        </p>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        This records workspace is for adult documentation and organization. It
        does not provide legal advice, emergency response, child accounts,
        payment processing, bank scraping, or a guarantee of court
        admissibility.
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <h2 className="text-base font-semibold text-slate-950">
              {section.title}
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {section.body.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
        <h2 className="text-base font-semibold text-slate-950">Contact</h2>
        <p className="mt-2">
          Questions about these draft terms can be sent through the{" "}
          <Link href="/contact" className="font-semibold text-emerald-700">
            contact page
          </Link>
          . Production should also publish a monitored security contact before
          accepting real records.
        </p>
      </section>
    </div>
  );
}
