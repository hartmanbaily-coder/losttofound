import { PolicyPage, type PolicySection } from "@/components/PolicyPage";
import { supportEmail, supportMailto } from "@/lib/site";

const sections: PolicySection[] = [
  {
    title: "General support",
    body: [
      "Use support for account access, sign in problems, authenticator recovery, file upload issues, import issues, export issues, calendar behavior, report bugs, and product feedback.",
      "Include the affected page or route, what you expected to happen, what happened instead, browser/device details, and any visible error message.",
      "Do not include passwords, authenticator codes, full message archives, full court files, or unnecessary child details in the initial email.",
    ],
  },
  {
    title: "Privacy requests",
    body: [
      "Use support for access, correction, deletion, export, account data, retention, or privacy policy questions.",
      "Include the email address connected to the account so the request can be matched after verification.",
      "Some privacy requests may require identity verification before action is taken.",
    ],
  },
  {
    title: "Security reports",
    body: [
      "Report suspected unauthorized access, cross account data exposure, private file access issues, login or MFA problems, evidence download concerns, or security vulnerabilities.",
      "Include concise reproduction steps, route, account email involved, time observed, browser/device details, and screenshots only if they are redacted.",
      "Do not test against another user's account or access records that are not yours.",
    ],
  },
  {
    title: "Accessibility issues",
    body: [
      "Report inaccessible forms, buttons, calendar controls, charts, exports, navigation, contrast, keyboard access, screen reader issues, or mobile layout problems.",
      "Include the page, task, browser, device, assistive technology if relevant, and what blocked completion.",
      "If a workaround exists, include it so the issue can be prioritized accurately.",
    ],
  },
  {
    title: "Legal and emergency boundaries",
    body: [
      "Support cannot provide legal advice, court strategy, filing advice, emergency response, law enforcement response, or supervised exchange services.",
      "For legal advice, contact a qualified attorney. For emergencies or immediate safety concerns, contact local emergency services or appropriate authorities.",
      "For court deadlines or filing requirements, verify requirements with the court, agency, attorney, or governing body.",
    ],
  },
  {
    title: "Response expectations",
    body: [
      "Support response times are not guaranteed while the product is still being prepared for broader use.",
      "Security, account access, privacy, and evidence file issues should be prioritized over general feature requests.",
      "Do not rely on support email as the only place to preserve court records, original evidence, or deadlines.",
    ],
  },
];

export default function ContactPage() {
  return (
    <PolicyPage
      title="Contact"
      description="Use this page to reach support for account, privacy, security, accessibility, file, import, export, and product issues."
      notice="Use the support address below instead of a personal email. Keep sensitive case details out of the initial subject line and message unless they are needed to understand the issue."
      sections={sections}
    >
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
        <h2 className="text-base font-semibold text-slate-950">Support Email</h2>
        <p className="mt-2">
          Email{" "}
          <a href={supportMailto} className="font-mono font-semibold text-emerald-700 underline underline-offset-2">
            {supportEmail}
          </a>
          .
        </p>
      </section>
    </PolicyPage>
  );
}
