import { PolicyPage, type PolicySection } from "@/components/PolicyPage";
import { accountDeletionPath, supportEmail, supportMailto } from "@/lib/site";
import Link from "next/link";

const sections: PolicySection[] = [
  {
    title: "Information we collect",
    body: [
      "Account information such as email address, authentication identifiers, session state, account status, and timezone.",
      "Records you choose to enter, including custody matter labels, parenting time schedules, exchange logs, notes, support records, expense records, document requests, report settings, and audit history.",
      "Files you choose to upload, including PDFs, images, text files, CSV files, message exports, court orders, parenting plans, receipts, screenshots, and related file metadata.",
      "Operational information needed to run and secure the service, including request route, status code, request id, timestamp, security event metadata, rate limit events, and diagnostic logs.",
    ],
  },
  {
    title: "Sensitive records",
    body: [
      "Custody, parenting time, court, school, health adjacent, financial, child support, expense, and evidence records can be sensitive.",
      "The service is designed for adult users organizing their own records. It does not offer child accounts, child facing features, public profiles, public social features, or coparent messaging.",
      "Users should avoid entering Social Security numbers, full bank account numbers, full card numbers, login credentials, unrelated third party details, or unnecessary medical detail.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "To provide the private records workspace, calendar, timeline, files area, import tools, reports, exports, and account settings.",
      "To authenticate users, protect accounts, enforce authorization, prevent abuse, monitor reliability, investigate security events, and maintain backups.",
      "To respond to support, privacy, security, accessibility, deletion, export, and account recovery requests.",
      "To comply with legal obligations, enforce terms, respond to valid legal process, and protect rights, safety, security, and service integrity.",
    ],
  },
  {
    title: "AI assisted import",
    body: [
      "If AI assisted import is enabled, the app may send selected user provided text or documents to the configured AI provider so the service can draft structured timeline entries, calendar items, file summaries, or report inputs.",
      "AI assisted output is not legal advice, not a court finding, and not a substitute for reviewing the original source material.",
      "Users should review, edit, and approve imported records before relying on them, exporting them, or sharing them with an attorney, court, agency, or other third party.",
      "The AI data use page explains what may be sent, what should not be uploaded, and how provider data controls are expected to work.",
    ],
  },
  {
    title: "Files and evidence",
    body: [
      "Files are intended to be stored in private object storage and downloaded through authenticated server routes rather than public links.",
      "Uploads may be limited by type, size, malware scan result, authorization, or security policy.",
      "File names, descriptions, tags, and extracted text may be visible inside your account and may be included in exports you choose to create.",
      "Users are responsible for preserving originals and protecting any downloaded exports after they leave the protected app environment.",
    ],
  },
  {
    title: "Sharing and service providers",
    body: [
      "We do not sell custody records, evidence files, or account data.",
      "We do not use advertising trackers or third party session replay in the records workspace.",
      "We may share limited information with service providers that help operate hosting, authentication, database, private storage, malware scanning, logging, monitoring, email delivery, support, security operations, or AI assisted import if enabled.",
      "We may disclose information if required by law, court order, subpoena, valid legal process, or to protect rights, safety, security, and service integrity.",
    ],
  },
  {
    title: "Attorney guest access",
    body: [
      "If you invite an attorney guest, the invited adult account can view the selected case and download its reports and evidence through a dedicated read-only portal for seven days after acceptance, following email confirmation and multi factor authentication.",
      "The owner can see pending and accepted invitation status and privacy-safe access, report, and evidence-download events. Activity logs do not intentionally include note bodies, file names, payment references, report contents, raw invitation tokens, or storage locations.",
      "The seven-day access period ending, revocation, case deletion, or an account deletion request blocks future protected requests, but copies already downloaded by the attorney cannot be recalled. A new invitation is required for another access period.",
      "An invitation does not by itself establish legal representation or attorney-client privilege. Attorney-sharing, activity-log retention, and deletion language require qualified legal review before broad launch.",
    ],
  },
  {
    title: "Cookies and tracking",
    body: [
      "The service uses authentication and session cookies needed to keep users signed in and protect account access.",
      "The records workspace is not designed around advertising cookies, behavioral advertising, public social sharing, or third party session replay.",
      "Because browser privacy signals such as Do Not Track are not standardized, the app does not currently change functionality in response to those signals.",
    ],
  },
  {
    title: "Retention and deletion",
    body: [
      "Records are retained while the account or case remains active unless deleted earlier by the user or under an approved retention process.",
      "Evidence files should be deleted from private storage when the related file item, case, or account is deleted, subject to backup aging, legal holds, and security investigation needs.",
      "Backups may retain deleted information until the applicable backup retention period expires.",
      "Deletion may be delayed or limited where legal obligations, account security, valid process, or incident response require retention.",
    ],
  },
  {
    title: "Your choices and requests",
    body: [
      "Users can use privacy minded labels instead of real names and can avoid entering unnecessary sensitive identifiers.",
      "Users can export records and download files where export/download controls are available.",
      "Users can start complete account deletion from the account deletion page, and can request access, correction, account support, privacy review, or security review by emailing the support address below.",
      "Some requests may require identity verification before action is taken.",
    ],
  },
  {
    title: "Children's information",
    body: [
      "The app is for adult account holders and is not directed to children under 13.",
      "Adults may store records that refer to children when those records are part of their custody or parenting time documentation.",
      "Do not create an account for a child, invite a child to use the service, or upload unnecessary child identifiers.",
    ],
  },
  {
    title: "Security and incidents",
    body: [
      "The app is designed around server managed cookies, private storage, server side authorization checks, file validation, malware scanning, rate limits, and security event logging.",
      "No internet service can guarantee absolute security, so users should protect their devices, passwords, authenticator apps, and downloaded exports.",
      "If we learn of a security incident involving personal information, we will evaluate notice obligations under applicable law and the approved incident response process.",
    ],
  },
  {
    title: "Policy changes",
    body: [
      "We may update this policy as the app, vendors, features, security practices, or legal requirements change.",
      "The updated date on this page identifies the current version.",
      "Material changes should be posted in the app or on the site before they take effect when practical.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      description="This policy explains how the records workspace handles account data, custody records, uploaded files, support requests, security events, and AI assisted import if enabled."
      notice="This page is a product privacy notice for adult users organizing private records. It is not legal advice and should be reviewed by qualified counsel before broad public launch."
      sections={sections}
    >
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
        <h2 className="text-base font-semibold text-slate-950">Privacy Requests</h2>
        <p className="mt-2">
          Start a complete account deletion request from{" "}
          <Link href={accountDeletionPath} className="font-semibold text-emerald-700 underline underline-offset-2">
            Delete Account
          </Link>
          . Send other privacy, access, correction, or account-data requests to{" "}
          <a href={supportMailto} className="font-mono font-semibold text-emerald-700 underline underline-offset-2">
            {supportEmail}
          </a>
          . Include the email address associated with the account and do not include sensitive case details in the subject line.
        </p>
      </section>
    </PolicyPage>
  );
}
