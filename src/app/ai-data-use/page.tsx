import { PolicyPage, type PolicySection } from "@/components/PolicyPage";

const sections: PolicySection[] = [
  {
    title: "Purpose",
    body: [
      "AI assisted import is intended to help adult users convert notes, message exports, documents, or file summaries into structured draft records.",
      "Possible outputs include draft timeline entries, draft calendar items, suggested tags, file summaries, report inputs, and quality review warnings.",
      "AI assisted import is optional and should be used only when the user chooses to submit material for processing.",
    ],
  },
  {
    title: "What may be sent",
    body: [
      "If enabled, the app may send selected text, document content, file metadata, user instructions, and case configuration needed to structure the import.",
      "The app should send the minimum context needed for the import task and should avoid sending unrelated records.",
      "Uploads or pasted notes may contain sensitive custody, court, financial, child related, or health adjacent details, so users should review material before submitting it.",
    ],
  },
  {
    title: "What not to submit",
    body: [
      "Do not submit Social Security numbers, full bank account numbers, full card numbers, passwords, authenticator codes, bank login credentials, or unrelated third party records.",
      "Do not submit confidential material you do not have the right to store, process, or use.",
      "Do not rely on AI import as the only copy of a record; preserve original files and exports separately.",
    ],
  },
  {
    title: "Provider handling",
    body: [
      "When OpenAI API services are used, requests should be made from server side routes using server only credentials rather than browser exposed keys.",
      "OpenAI's data controls documentation states that API inputs and outputs are not used to train models unless the customer opts in.",
      "Provider retention, abuse monitoring, legal process response, regional processing, and enterprise settings may vary by provider and configuration.",
    ],
  },
  {
    title: "Human review required",
    body: [
      "AI output may be incomplete, inaccurate, duplicated, overbroad, or missing context from the source material.",
      "Users should review each draft record, compare it to the original source, correct dates and wording, and decide whether to save it.",
      "AI output is not legal advice, legal strategy, court testimony, a finding of fact, or a guarantee that a record will be useful in court.",
    ],
  },
  {
    title: "Privacy controls",
    body: [
      "The app should provide clear notice before AI assisted import sends user material to a provider.",
      "Imported drafts should remain private to the authenticated account unless the user exports or shares them.",
      "Users should be able to delete draft or saved records subject to backup aging, legal holds, security investigation needs, and the retention process.",
    ],
  },
  {
    title: "Operational safeguards",
    body: [
      "AI import should be rate limited, logged for security, and reviewed for errors without storing more sensitive content in logs than needed.",
      "Server routes should validate file type, size, authorization, and feature enablement before processing user material.",
      "Vendor/security review should be completed before enabling AI import for production user data.",
    ],
  },
  {
    title: "Future changes",
    body: [
      "The AI provider, model, retention settings, and import workflow may change as the feature matures.",
      "Material provider or workflow changes should be reflected in this page, the privacy policy, and the subprocessors page.",
      "Users should review this page before submitting highly sensitive records for AI assisted processing.",
    ],
  },
];

export default function AiDataUsePage() {
  return (
    <PolicyPage
      title="AI Data Use"
      description="This page explains how AI assisted import should handle user provided notes, message exports, documents, and file summaries if the feature is enabled."
      notice="AI assisted import should not be enabled for production user data until vendor review, server side key storage, user notice, and human review workflows are approved."
      sections={sections}
    />
  );
}
