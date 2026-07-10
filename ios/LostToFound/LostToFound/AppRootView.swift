import SwiftUI
import WebKit

private enum AppTab: String, CaseIterable, Identifiable {
    case workspace
    case privacy
    case support

    var id: String { rawValue }

    var title: String {
        switch self {
        case .workspace:
            "Records"
        case .privacy:
            "Policies"
        case .support:
            "Support"
        }
    }

    var symbolName: String {
        switch self {
        case .workspace:
            "folder.badge.person.crop"
        case .privacy:
            "doc.text.magnifyingglass"
        case .support:
            "questionmark.circle"
        }
    }
}

struct AppRootView: View {
    @Environment(\.scenePhase) private var scenePhase

    @State private var isUnlocked = false
    @State private var hasUnlockedOnce = false
    @State private var hasCheckedForSession = false
    @State private var selectedTab: AppTab = .workspace

    var body: some View {
        ZStack {
            if hasUnlockedOnce {
                TabView(selection: $selectedTab) {
                    NavigationStack {
                        WorkspaceScreen()
                    }
                    .tabItem { Label(AppTab.workspace.title, systemImage: AppTab.workspace.symbolName) }
                    .tag(AppTab.workspace)

                    NavigationStack {
                        PrivacySummaryView()
                    }
                    .tabItem { Label(AppTab.privacy.title, systemImage: AppTab.privacy.symbolName) }
                    .tag(AppTab.privacy)

                    NavigationStack {
                        SupportView()
                    }
                    .tabItem { Label(AppTab.support.title, systemImage: AppTab.support.symbolName) }
                    .tag(AppTab.support)
                }
                .allowsHitTesting(isUnlocked)
                .accessibilityHidden(!isUnlocked)
            } else {
                Color(uiColor: .systemBackground)
                    .ignoresSafeArea()
            }

            if !hasCheckedForSession {
                ProgressView()
                    .controlSize(.large)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(uiColor: .systemBackground).ignoresSafeArea())
                    .zIndex(1)
            } else if !isUnlocked {
                AuthenticationGate {
                    withAnimation(.snappy) {
                        hasUnlockedOnce = true
                        isUnlocked = true
                    }
                }
                .background(Color(uiColor: .systemBackground).ignoresSafeArea())
                .zIndex(1)
            }
        }
        .tint(Color("AccentColor"))
        .task {
            guard !hasCheckedForSession else { return }

            let cookieStore = WKWebsiteDataStore.default().httpCookieStore
            let hasSession = await SecureSessionCookieStore.shared.hasRestorableSession(cookieStore)
            hasCheckedForSession = true

            if !hasSession {
                hasUnlockedOnce = true
                isUnlocked = true
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard isUnlocked, newPhase != .active else { return }

            Task { @MainActor in
                let cookieStore = WKWebsiteDataStore.default().httpCookieStore
                let hasSession = await SecureSessionCookieStore.shared.hasRestorableSession(cookieStore)
                guard scenePhase != .active, hasSession else { return }
                isUnlocked = false
            }
        }
    }
}
