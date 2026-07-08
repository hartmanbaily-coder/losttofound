import SwiftUI

struct PrivacySummaryView: View {
    private let policyLinks: [PolicyLink] = [
        PolicyLink(title: "Privacy Policy", url: URL(string: "https://losttofound.org/privacy")!),
        PolicyLink(title: "Terms of Use", url: URL(string: "https://losttofound.org/terms")!),
        PolicyLink(title: "Security", url: URL(string: "https://losttofound.org/security")!),
        PolicyLink(title: "AI Data Use", url: URL(string: "https://losttofound.org/ai-data-use")!),
        PolicyLink(title: "Subprocessors", url: URL(string: "https://losttofound.org/subprocessors")!)
    ]

    var body: some View {
        List {
            Section {
                Text("Lost to Found is for adult users organizing private custody and parenting-plan records. It does not provide legal advice, legal strategy, or emergency services.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }

            Section("Data Boundaries") {
                Label("No child accounts", systemImage: "person.crop.circle.badge.xmark")
                Label("No public profiles or social feeds", systemImage: "eye.slash")
                Label("No advertising trackers", systemImage: "hand.raised")
                Label("User-controlled records and exports", systemImage: "doc.text.magnifyingglass")
            }

            Section("Policies") {
                ForEach(policyLinks) { link in
                    Link(destination: link.url) {
                        Label(link.title, systemImage: "safari")
                    }
                }
            }
        }
        .navigationTitle("Privacy")
    }
}

struct SupportView: View {
    private let supportEmail = "support@lendori.io"

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Need account, privacy, deletion, accessibility, or security help?")
                        .font(.headline)
                    Text("Email support without putting sensitive case details in the subject line.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }

            Section("Contact") {
                Link(destination: URL(string: "mailto:\(supportEmail)")!) {
                    Label(supportEmail, systemImage: "envelope")
                }

                Link(destination: URL(string: "https://losttofound.org/contact")!) {
                    Label("Contact page", systemImage: "safari")
                }
            }

            Section("App Review Notes") {
                Text("This app is a private records organizer for adults. It is not a law firm, attorney-client portal, emergency tool, child-facing app, or co-parent messaging system.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Support")
    }
}

private struct PolicyLink: Identifiable {
    let title: String
    let url: URL

    var id: String { url.absoluteString }
}
