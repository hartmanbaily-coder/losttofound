import SwiftUI

@main
struct LostToFoundApp: App {
    init() {
        SensitiveExportStore.shared.purge()
    }

    var body: some Scene {
        WindowGroup {
            AppRootView()
        }
    }
}
