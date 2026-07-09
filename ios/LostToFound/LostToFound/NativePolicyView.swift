import SwiftUI

enum AppBrand {
    static let name = "Lost to Found Case Organization"
    static let tagline = "Remove the emotion. Track the data."
    static let supportEmail = "support@lendori.io"
    static let legalDisclaimer = "This app helps organize records and does not provide legal advice. Consult a qualified attorney about your situation."
}

private let appPolicyLinks: [PolicyLink] = [
    PolicyLink(title: "Privacy Policy", url: URL(string: "https://losttofound.org/privacy")!),
    PolicyLink(title: "Terms of Use", url: URL(string: "https://losttofound.org/terms")!),
    PolicyLink(title: "Security", url: URL(string: "https://losttofound.org/security")!),
    PolicyLink(title: "AI Data Use", url: URL(string: "https://losttofound.org/ai-data-use")!),
    PolicyLink(title: "Subprocessors", url: URL(string: "https://losttofound.org/subprocessors")!),
    PolicyLink(title: "Accessibility", url: URL(string: "https://losttofound.org/accessibility")!),
    PolicyLink(title: "Contact", url: URL(string: "https://losttofound.org/contact")!)
]

struct AppBrandMark: View {
    var size: CGFloat = 56

    var body: some View {
        Image("BookGavelLogo")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

struct AppBrandHeader: View {
    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            AppBrandMark(size: 52)

            VStack(alignment: .leading, spacing: 3) {
                Text(AppBrand.name)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(AppBrand.tagline)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct PrivacySummaryView: View {
    var body: some View {
        List {
            Section {
                AppBrandHeader()

                Text("Lost to Found is for adult users organizing private custody and parenting plan records.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }

            Section("Data Boundaries") {
                Label("No child accounts", systemImage: "person.crop.circle.badge.xmark")
                Label("No public profiles or social feeds", systemImage: "eye.slash")
                Label("No advertising trackers", systemImage: "hand.raised")
                Label("User controlled records and exports", systemImage: "doc.text.magnifyingglass")
            }

            NativePolicyFooterSections()
        }
        .navigationTitle("Policies")
    }
}

struct SupportView: View {
    var body: some View {
        List {
            Section {
                AppBrandHeader()

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
                Link(destination: URL(string: "mailto:\(AppBrand.supportEmail)")!) {
                    Label(AppBrand.supportEmail, systemImage: "envelope")
                }

                Link(destination: URL(string: "https://losttofound.org/contact")!) {
                    Label("Contact page", systemImage: "safari")
                }
            }

            NativePolicyFooterSections()
        }
        .navigationTitle("Support")
    }
}

private struct NativePolicyFooterSections: View {
    var body: some View {
        Section("Policy Center") {
            ForEach(appPolicyLinks) { link in
                Link(destination: link.url) {
                    Label(link.title, systemImage: "safari")
                }
            }
        }

        Section("Disclaimer") {
            Text(AppBrand.legalDisclaimer)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }
}

private struct PolicyLink: Identifiable {
    let title: String
    let url: URL

    var id: String { url.absoluteString }
}
