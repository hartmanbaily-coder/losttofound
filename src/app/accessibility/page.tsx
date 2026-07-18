import { PolicyPage, type PolicySection } from "@/components/PolicyPage";
import { supportEmail, supportMailto } from "@/lib/site";

const sections: PolicySection[] = [
  {
    title: "Commitment",
    body: [
      "My Custody Case is intended to be usable by adult users who need to organize sensitive family court records without unnecessary visual or technical barriers.",
      "The site should be developed toward recognized web accessibility practices, including keyboard access, readable contrast, semantic structure, form labels, focus states, and responsive layouts.",
      "Accessibility work should continue as the app adds imports, reports, file handling, charts, and calendar interactions.",
    ],
  },
  {
    title: "Design and interaction goals",
    body: [
      "Navigation, forms, buttons, tabs, export controls, and account actions should be reachable by keyboard where practical.",
      "Text should remain readable at common zoom levels and should not rely on color alone to communicate critical status.",
      "Calendars, charts, tables, and reports should include text alternatives, summaries, labels, or exportable tabular data where practical.",
    ],
  },
  {
    title: "Known complex areas",
    body: [
      "Drag to paint calendar interactions may require alternate click, form, or keyboard accessible paths for users who cannot use pointer dragging.",
      "Charts and visual reports should be paired with written summaries or tables so the data is not available only visually.",
      "Uploaded third party PDFs, screenshots, message exports, or court documents may not be accessible if the source file itself is not accessible.",
    ],
  },
  {
    title: "Compatibility",
    body: [
      "The app is built as a modern web application and should work best in current versions of major browsers.",
      "Authentication, file upload, calendar editing, and report export workflows may rely on browser features such as JavaScript, cookies, file inputs, and secure connections.",
      "If a browser, assistive technology, or device creates a barrier, please report the route, task, browser, device, and assistive technology involved.",
    ],
  },
  {
    title: "Feedback process",
    body: [
      "Accessibility issues should be reported through the support email with enough detail to reproduce the barrier.",
      "Useful details include the page URL, affected task, browser, operating system, assistive technology, screen size, and what happened.",
      "Do not include sensitive case details, child identifiers, court filings, or private records unless specifically requested for troubleshooting.",
    ],
  },
  {
    title: "Ongoing review",
    body: [
      "Accessibility should be reviewed when adding new workflows such as AI import, document upload, report export, charting, calendar editing, and account recovery.",
      "Automated checks can help catch some issues, but manual keyboard and screen reader review may still be needed.",
      "Known accessibility limitations should be tracked and prioritized alongside security, privacy, and product reliability work.",
    ],
  },
];

export default function AccessibilityPage() {
  return (
    <PolicyPage
      title="Accessibility Statement"
      description="This page describes the accessibility goals for the records workspace and how users can report access barriers."
      notice="If you cannot access a feature or page, contact support with the affected route and task. Do not send sensitive case files unless requested."
      sections={sections}
    >
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
        <h2 className="text-base font-semibold text-slate-950">Accessibility Contact</h2>
        <p className="mt-2">
          Email accessibility issues to{" "}
          <a href={supportMailto} className="font-mono font-semibold text-emerald-700 underline underline-offset-2">
            {supportEmail}
          </a>
          . Use a subject such as My Custody Case accessibility issue and include the page, browser, device, and affected task.
        </p>
      </section>
    </PolicyPage>
  );
}
