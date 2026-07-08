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
    }
}
