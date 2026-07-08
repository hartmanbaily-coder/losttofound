import SwiftUI

private enum AppTab: String, CaseIterable, Identifiable {
    case workspace
    case privacy
    case support

    var id: String { rawValue }

    var title: String {
        switch self {
        case .workspace:
            "Workspace"
        case .privacy:
            "Privacy"
        case .support:
            "Support"
        }
    }

    var symbolName: String {
        switch self {
        case .workspace:
            "folder.badge.person.crop"
        case .privacy:
            "lock.shield"
        case .support:
            "questionmark.circle"
        }
    }
}

struct AppRootView: View {
    @Environment(\.scenePhase) private var scenePhase

    @State private var isUnlocked = false
    @State private var selectedTab: AppTab = .workspace

    var body: some View {
        Group {
            if isUnlocked {
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
            } else {
                AuthenticationGate {
                    withAnimation(.snappy) {
                        isUnlocked = true
                    }
                }
            }
        }
        .tint(Color("AccentColor"))
        .onChange(of: scenePhase) { _, newPhase in
            guard isUnlocked, newPhase != .active else { return }
            selectedTab = .workspace
            isUnlocked = false
        }
    }
}
