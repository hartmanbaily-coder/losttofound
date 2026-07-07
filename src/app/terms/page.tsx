import { PolicyPage, type PolicySection } from "@/components/PolicyPage";

const sections: PolicySection[] = [
  {
    title: "Records workspace",
    body: [
      "Lost to Found Records is a private workspace for adults organizing custody, parenting-time, child support, expense, file, and family-court documentation.",
      "The service is for factual organization, recordkeeping, calendar planning, file storage, and user-directed report exports.",
      "The service may change as account controls, imports, exports, deletion workflows, retention policies, and security operations mature.",
    ],
  },
  {
    title: "Adult use",
    body: [
      "The service is intended for adult users only.",
      "Do not create accounts for children, invite children to use the service, or use the service as a child-facing product.",
      "Users are responsible for using privacy-friendly labels and avoiding unnecessary sensitive identifiers.",
    ],
  },
  {
    title: "No legal advice",
    body: [
      "The service does not provide legal advice, legal strategy, legal determinations, filing advice, legal representation, or attorney-client privilege.",
      "Users should consult a qualified attorney about court orders, evidence handling, filing requirements, child support obligations, and their specific situation.",
      "Generated summaries, timelines, calendars, exports, and reports are user organization tools, not legal findings or court-ready legal arguments by themselves.",
    ],
  },
  {
    title: "User responsibility",
    body: [
      "Users are responsible for the accuracy, completeness, legality, and appropriateness of records they enter, upload, import, export, or share.",
      "Users should verify imported records against original source materials before using them in reports or sharing them with an attorney, court, agency, or other third party.",
      "Users are responsible for protecting downloaded files and exports after they leave the app's protected storage.",
    ],
  },
  {
    title: "Evidence and admissibility",
    body: [
      "The service does not guarantee that any note, file, photo, receipt, export, report, calendar, or evidence item will be accepted or relied on by a court, agency, mediator, attorney, or other third party.",
      "Users are responsible for preserving originals, following applicable court rules, avoiding misleading edits, and keeping records complete enough to verify context.",
      "The service may reject files by type, size, malware scan result, authorization failure, or security policy.",
    ],
  },
  {
    title: "AI-assisted features",
    body: [
      "AI-assisted import, if enabled, is intended to help structure user-provided notes, messages, documents, or file summaries.",
      "AI output can be incomplete, inaccurate, or overbroad and must be reviewed by the user before saving, exporting, or relying on it.",
      "AI-assisted features do not provide legal advice, predict court outcomes, determine credibility, or decide whether evidence is admissible.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "Do not use the service to harass, stalk, threaten, impersonate, surveil, dox, or unlawfully disclose another person's information.",
      "Do not upload malware, exploit code, illegal content, or content you do not have the right to store or use.",
      "Do not attempt to bypass authorization, access another user's records, disrupt the service, reverse engineer private security controls, or overload import/export workflows.",
    ],
  },
  {
    title: "Safety boundaries",
    body: [
      "The service is not an emergency service, crisis service, law enforcement tool, supervised exchange service, or safety-response provider.",
      "Users should contact local emergency services, law enforcement, legal counsel, court staff, or qualified support professionals when appropriate.",
      "The service does not monitor family safety, enforce court orders, or contact another parent or third party on a user's behalf.",
    ],
  },
  {
    title: "Accounts and security",
    body: [
      "Users are responsible for keeping account credentials, devices, email accounts, and authenticator apps secure.",
      "The service may require multi-factor authentication, stronger password rules, session controls, account verification, rate limits, or manual review.",
      "Users should promptly report suspected unauthorized access or security concerns through the support contact.",
    ],
  },
  {
    title: "Payments and financial records",
    body: [
      "Child support and expense tools are for documentation only.",
      "The service does not process child support payments, collect bank login credentials, scrape bank accounts, store full account/card numbers, or verify that a payment legally satisfies an obligation.",
      "Users are responsible for confirming payment status with their bank, payment provider, agency, court, attorney, or other appropriate source.",
    ],
  },
  {
    title: "Availability and changes",
    body: [
      "The service may be unavailable during maintenance, security events, vendor outages, deployment work, or operational incidents.",
      "Features may be added, changed, limited, or removed as the service matures.",
      "We may update these terms and will identify the current version by the updated date on this page.",
    ],
  },
  {
    title: "Deletion and retention",
    body: [
      "Users may be offered export, file deletion, case deletion, and account deletion controls.",
      "Deleted records may remain in backups until those backups expire under the retention schedule.",
      "Deletion may be delayed or limited when legally required, when needed for security investigation, or when a valid hold applies.",
    ],
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of Use"
      description="These terms set the boundaries for using the records workspace, including adult-only use, no legal advice, evidence limitations, AI-assisted import, account security, and acceptable use."
      notice="These terms are a product baseline and should be reviewed by qualified counsel before broad public launch or before relying on them for customer-facing enforcement."
      sections={sections}
    />
  );
}
