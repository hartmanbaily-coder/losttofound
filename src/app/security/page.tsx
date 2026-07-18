import { PolicyPage, type PolicySection } from "@/components/PolicyPage";
import { supportEmail, supportMailto } from "@/lib/site";

const sections: PolicySection[] = [
  {
    title: "Security posture",
    body: [
      "The records workspace is designed for private custody and family court records, so security controls focus on authentication, authorization, private storage, malware resistant uploads, and conservative data sharing.",
      "The app uses server managed HttpOnly cookies, server side records API routes, Supabase Auth, private evidence storage, and route level authorization checks.",
      "Security sensitive configuration, such as service keys and AI provider keys, should remain in server side secret storage and should not be exposed to browser code.",
    ],
  },
  {
    title: "Account protection",
    body: [
      "Production accounts may require strong passwords, email verification, multi factor authentication, session controls, and manual recovery review.",
      "Users should protect their email account, device, password manager, and authenticator app because those can affect access to records.",
      "Manual recovery requests may require identity and account verification before access is restored.",
    ],
  },
  {
    title: "Record isolation",
    body: [
      "Records are scoped by authenticated user and custody matter so one user's records should not be available to another user.",
      "Server routes should enforce ownership before reading, saving, exporting, downloading, or deleting records and files.",
      "Any cross account data exposure concern should be reported immediately as a security issue.",
    ],
  },
  {
    title: "File uploads",
    body: [
      "Evidence files may be checked for file type, size, authorization, and malware scan result before storage or later use.",
      "Files should be stored in private buckets or private object storage, not public anonymous links.",
      "Downloaded files and generated exports are no longer protected by the app once a user stores or shares them outside the service.",
    ],
  },
  {
    title: "Monitoring and logging",
    body: [
      "Operational logs may include request metadata, security events, failed login patterns, rate limit events, upload decisions, and incident response details.",
      "Logs should avoid unnecessary sensitive case details, full file contents, passwords, authentication codes, service role keys, and raw private storage paths.",
      "Security events may be reviewed to investigate abuse, reliability issues, unauthorized access attempts, and suspected incidents.",
    ],
  },
  {
    title: "Incident response",
    body: [
      "If a suspected security incident occurs, the response process should identify affected systems, preserve relevant logs, contain the issue, evaluate affected data, remediate the root cause, and determine notice obligations.",
      "State breach notification laws and other privacy obligations may require notice when certain personal information is involved.",
      "Incident handling may limit account access, file downloads, imports, or exports while investigation and containment are underway.",
    ],
  },
  {
    title: "Responsible disclosure",
    body: [
      "Please report suspected vulnerabilities, authentication problems, authorization bypasses, data exposure, private file access issues, or cross account access concerns promptly.",
      "Do not access, modify, copy, delete, or disclose another user's records while testing or reporting a concern.",
      "This site does not currently offer a paid bug bounty. Reports are still appreciated and will be reviewed based on severity and reproducibility.",
    ],
  },
  {
    title: "What not to send by email",
    body: [
      "Do not email passwords, authenticator codes, full court files, full message archives, Social Security numbers, full bank account numbers, or full card numbers.",
      "For security reports, include the route, account email involved, time observed, browser/device details, and concise reproduction steps.",
      "If screenshots are needed, redact unnecessary names, child details, addresses, financial identifiers, and court sensitive material.",
    ],
  },
];

export default function SecurityPage() {
  return (
    <PolicyPage
      title="Security"
      description="This page explains the security posture for the records workspace, how file and account protections are intended to work, and how to report concerns."
      notice="Security controls reduce risk but do not make any internet service risk free. Keep local downloads, exports, passwords, and devices protected."
      sections={sections}
    >
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
        <h2 className="text-base font-semibold text-slate-950">Report a Security Issue</h2>
        <p className="mt-2">
          Email security reports to{" "}
          <a href={supportMailto} className="font-mono font-semibold text-emerald-700 underline underline-offset-2">
            {supportEmail}
          </a>
          . Use a clear subject such as My Custody Case security report and avoid including sensitive case details unless requested for investigation.
        </p>
      </section>
    </PolicyPage>
  );
}
