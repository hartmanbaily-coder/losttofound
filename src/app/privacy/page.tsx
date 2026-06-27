import Link from "next/link";

const lastUpdated = "June 16, 2026";

const sections = [
  {
    title: "Information we collect",
    body: [
      "Account information such as email address, authentication identifiers, profile labels, and timezone.",
      "Records you choose to enter, including custody matter labels, parenting-time schedules, exchange logs, notes, child support records, expense records, evidence metadata, audit events, and report selections.",
      "Evidence files you choose to upload in Supabase-backed production mode, such as PDFs, images, text files, or CSV files.",
      "Operational information needed to secure and run the service, such as route, status code, request id, timestamps, and security event metadata.",
    ],
  },
  {
    title: "Sensitive information",
    body: [
      "Custody, child-related, court, school, health-adjacent, financial, child support, and evidence records can be sensitive.",
      "The service is designed for adult users. We do not offer child accounts, child profiles, public social features, or co-parent messaging in this MVP.",
      "Users should avoid entering Social Security numbers, full bank account numbers, full card numbers, bank login credentials, unrelated third-party details, or unnecessary medical detail.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "To provide the private records workspace, evidence index, calendar, support/expense tools, and report exports.",
      "To authenticate users, protect accounts, enforce authorization, prevent abuse, monitor reliability, and investigate security incidents.",
      "To comply with legal obligations, enforce terms, respond to user requests, and protect the service.",
    ],
  },
  {
    title: "Evidence files",
    body: [
      "Evidence files are stored in private object storage in Supabase-backed production mode.",
      "Uploads are validated by file type and size, scanned for malware before storage, and downloaded only through authenticated server routes.",
      "We do not intentionally expose public evidence links or anonymous share links.",
    ],
  },
  {
    title: "Sharing",
    body: [
      "We do not sell user records or evidence files.",
      "We do not use advertising trackers or third-party session replay in this records workspace.",
      "We may share information with service providers that help operate hosting, authentication, storage, malware scanning, logging, monitoring, email, or security operations.",
      "We may disclose information if required by law, court order, subpoena, valid legal process, or to protect rights, safety, security, and service integrity.",
    ],
  },
  {
    title: "Retention and deletion",
    body: [
      "Records are retained while the account or case remains active unless deleted earlier by the user or as required by policy.",
      "Evidence files should be deleted from private storage when the related evidence item, case, or account is deleted, subject to backup aging and legal holds.",
      "Backups may retain deleted information until they expire under the backup retention schedule.",
      "Production deletion and retention details must be finalized before accepting real records.",
    ],
  },
  {
    title: "Security",
    body: [
      "Production mode uses server-managed HttpOnly cookies, Supabase Auth, private storage, server-side authorization checks, malware scanning, and readiness gates.",
      "Access tokens, service role keys, and raw storage paths should not be exposed in browser URLs or logs.",
      "No internet service can guarantee absolute security, so users should keep their own exports and downloaded files protected.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can use privacy-friendly labels instead of real names.",
      "You can export records and evidence files where export/download controls are available.",
      "You can request deletion of account or case records once production deletion workflows are enabled.",
      "You can contact us with privacy or security questions.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Lost to Found Records
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Privacy Policy Draft
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Last updated {lastUpdated}. This draft describes the intended privacy
          posture for the records workspace and should be reviewed by qualified
          counsel before production launch.
        </p>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        This records workspace is for adult users organizing private records. It
        does not provide legal advice, emergency services, child accounts,
        public profiles, payment processing, or bank scraping.
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">{section.title}</h2>
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
          For privacy or security questions, use the{" "}
          <Link href="/contact" className="font-semibold text-emerald-700">
            contact page
          </Link>
          . Production should also publish a monitored security contact mailbox
          before accepting real records.
        </p>
      </section>
    </div>
  );
}
