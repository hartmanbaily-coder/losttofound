import { PolicyPage, type PolicySection } from "@/components/PolicyPage";

const sections: PolicySection[] = [
  {
    title: "Purpose of this list",
    body: [
      "Subprocessors and vendors help operate the records workspace, authenticate users, store records, protect files, deliver email, monitor reliability, and support optional AI assisted import.",
      "This page is intended to give users a practical view of the service providers that may process account, records, file, operational, or security data.",
      "The list should be reviewed when vendors, hosting architecture, storage, malware scanning, email delivery, monitoring, or AI providers change.",
    ],
  },
  {
    title: "Supabase",
    body: [
      "Purpose: authentication, database, private storage, account sessions, password reset support, and records persistence.",
      "Data involved: account identifiers, session/auth data, records datasets, file metadata, private object storage contents, and related operational metadata.",
      "Status: core production infrastructure for the records workspace when Supabase mode is enabled.",
    ],
  },
  {
    title: "Cloudflare",
    body: [
      "Purpose: DNS, TLS, domain protection, caching, edge routing, security headers, and traffic protection for losttofound.org.",
      "Data involved: IP address, request metadata, route, headers, timing, security telemetry, and limited operational logs.",
      "Status: core public web infrastructure.",
    ],
  },
  {
    title: "GitHub",
    body: [
      "Purpose: source control, deployment automation, validation workflows, and operational change history.",
      "Data involved: source code, deployment logs, workflow metadata, and configuration references. User records should not be committed to source control.",
      "Status: development and deployment infrastructure, not intended for storage of user custody records.",
    ],
  },
  {
    title: "OpenAI",
    body: [
      "Purpose: optional AI assisted import, draft structuring, summarization, tagging, and extraction if AI import is enabled.",
      "Data involved: selected text, documents, file metadata, prompts, and model outputs submitted by the user for import assistance.",
      "Status: conditional provider. Vendor/security review and user notice should be complete before production user data is processed through AI import.",
    ],
  },
  {
    title: "Malware scanning provider",
    body: [
      "Purpose: scanning uploaded evidence files or file contents for malware or unsafe content before storage or use.",
      "Data involved: uploaded files, file hashes, file metadata, scan result, and security decision metadata.",
      "Status: provider name and processing details should be updated here when the production malware scanning provider is finalized.",
    ],
  },
  {
    title: "Email and support providers",
    body: [
      "Purpose: account emails, password reset messages, security notices, support requests, privacy requests, and accessibility requests.",
      "Data involved: email address, message metadata, support message contents, account recovery context, and operational logs.",
      "Status: provider names should be updated here when transactional email and support tooling are finalized.",
    ],
  },
  {
    title: "Changes to providers",
    body: [
      "Providers may change as the app matures or as security, hosting, compliance, support, or reliability needs change.",
      "Material changes should be reflected on this page and, when appropriate, in the privacy policy and AI data use page.",
      "Before accepting broad production user data, vendor/security review should confirm vendor purpose, access, retention, security commitments, and incident response contacts.",
    ],
  },
];

export default function SubprocessorsPage() {
  return (
    <PolicyPage
      title="Subprocessors"
      description="This page lists the vendors and infrastructure providers that may help operate the records workspace or process limited account, records, file, operational, security, or AI import data."
      notice="This is an operational vendor list. It should be kept current as production services, support tooling, malware scanning, monitoring, and AI assisted import providers are finalized."
      sections={sections}
    />
  );
}
