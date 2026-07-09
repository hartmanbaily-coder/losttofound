import Link from "next/link";

import { PolicyPage, type PolicySection } from "@/components/PolicyPage";
import { accountDeletionMailto, supportEmail } from "@/lib/site";

const sections: PolicySection[] = [
  {
    title: "What this request covers",
    body: [
      "Account deletion is for deleting the whole Lost to Found account record and associated personal account data.",
      "Associated records include custody matters, calendar records, timeline items, notes, file metadata, reports, support records kept with the account, and private uploaded evidence files where deletion is legally and technically permitted.",
      "Deleting only one custody matter or file can still be done from the Records workspace without deleting the whole account.",
    ],
  },
  {
    title: "Before you request deletion",
    body: [
      "Export any records, reports, or file indexes you need before requesting deletion.",
      "Download any private files you still need to preserve outside the service.",
      "Do not include passwords, authenticator codes, court files, message archives, Social Security numbers, full card numbers, or unnecessary child details in the request message.",
    ],
  },
  {
    title: "Timing and verification",
    body: [
      "Support may need to verify that the requester controls the account email before deletion is processed.",
      "Deletion may take time when private storage, backups, support records, security logs, or vendor systems must be reviewed.",
      "A confirmation should be sent after the deletion request is completed or if the request cannot be completed as submitted.",
    ],
  },
  {
    title: "What may be retained",
    body: [
      "Some information may remain for a limited time in backups until the applicable backup retention window expires.",
      "Security logs, audit records, support correspondence, billing records if any, and records under valid legal hold or legal obligation may be retained where required.",
      "Retained information should be limited to what is necessary for security, legal, financial, or operational requirements.",
    ],
  },
];

export default function AccountDeletePage() {
  return (
    <PolicyPage
      title="Delete Account"
      description="This page lets users start deletion of their Lost to Found account and associated records."
      notice="This deletion process should be reviewed by qualified counsel before broad public launch, especially for backup aging, legal holds, support verification, and security-log retention."
      sections={sections}
    >
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h2 className="text-base font-semibold text-slate-950">Start Deletion Request</h2>
        <p className="mt-3">
          Send the request from the email address connected to the account. Use a short message such as
          <span className="font-medium text-slate-800"> Please delete my Lost to Found account.</span> Support will follow up if verification or additional
          confirmation is required.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={accountDeletionMailto}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200"
          >
            Start account deletion
          </a>
          <Link
            href="/records"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-100"
          >
            Open records workspace
          </Link>
        </div>
        <p className="mt-4">
          Direct support address:{" "}
          <a href={accountDeletionMailto} className="font-mono font-semibold text-emerald-700 underline underline-offset-2">
            {supportEmail}
          </a>
        </p>
      </section>
    </PolicyPage>
  );
}
