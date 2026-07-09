import SwiftUI

enum AppBrand {
    static let name = "Lost to Found Case Organization"
    static let tagline = "Remove the emotion. Track the data."
    static let supportEmail = "support@lendori.io"
}

struct AppBrandMark: View {
    var size: CGFloat = 56

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.2, style: .continuous)
                .fill(Color("AccentColor"))
                .shadow(color: .black.opacity(0.12), radius: 10, y: 4)

            RoundedRectangle(cornerRadius: size * 0.2, style: .continuous)
                .stroke(.white.opacity(0.35), lineWidth: 1)

            Image(systemName: "book.closed.fill")
                .font(.system(size: size * 0.46, weight: .semibold))
                .foregroundStyle(.white)
                .offset(x: -size * 0.08, y: -size * 0.04)

            Image(systemName: "chart.bar.fill")
                .font(.system(size: size * 0.24, weight: .bold))
                .foregroundStyle(.white.opacity(0.92))
                .offset(x: size * 0.23, y: size * 0.17)

            Image(systemName: "hammer.fill")
                .font(.system(size: size * 0.24, weight: .bold))
                .foregroundStyle(.white.opacity(0.92))
                .rotationEffect(.degrees(-28))
                .offset(x: size * 0.23, y: -size * 0.18)
        }
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
    private let policyLinks: [PolicyLink] = [
        PolicyLink(title: "Privacy Policy", url: URL(string: "https://losttofound.org/privacy")!),
        PolicyLink(title: "Terms of Use", url: URL(string: "https://losttofound.org/terms")!),
        PolicyLink(title: "Security", url: URL(string: "https://losttofound.org/security")!),
        PolicyLink(title: "AI Data Use", url: URL(string: "https://losttofound.org/ai-data-use")!),
        PolicyLink(title: "Subprocessors", url: URL(string: "https://losttofound.org/subprocessors")!),
        PolicyLink(title: "Accessibility", url: URL(string: "https://losttofound.org/accessibility")!),
        PolicyLink(title: "Contact", url: URL(string: "https://losttofound.org/contact")!)
    ]

    var body: some View {
        List {
            Section {
                AppBrandHeader()

                Text("Lost to Found is for adult users organizing private custody and parenting plan records. It does not provide legal advice, legal strategy, or emergency services.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }

            Section("Data Boundaries") {
                Label("No child accounts", systemImage: "person.crop.circle.badge.xmark")
                Label("No public profiles or social feeds", systemImage: "eye.slash")
                Label("No advertising trackers", systemImage: "hand.raised")
                Label("User controlled records and exports", systemImage: "doc.text.magnifyingglass")
            }

            Section("Policy Center") {
                ForEach(policyLinks) { link in
                    Link(destination: link.url) {
                        Label(link.title, systemImage: "safari")
                    }
                }
            }
        }
        .navigationTitle("Policy Center")
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

            Section("App Review Notes") {
                Text("This app is a private records organizer for adults. It is not a law firm, attorney client portal, emergency tool, child facing app, or coparent messaging system.")
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
