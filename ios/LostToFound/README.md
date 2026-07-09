# Lost to Found iOS

This folder prepares Lost to Found Case Organization for the Apple App Store path.

The iOS app is a native SwiftUI shell with:

- Device authentication gate using Face ID, Touch ID, or device passcode.
- Native tab structure for Records, Policies, and Support.
- A controlled `WKWebView` workspace pointed at `https://losttofound.org/records`.
- External link handling that opens non-product links outside the workspace.
- Native privacy/support summaries that mirror the public policy pages.
- App icon assets generated from the original Lost to Found L2F logo.

## Local Setup

1. Open `ios/LostToFound/LostToFound.xcodeproj` in Xcode.
2. Select the `LostToFound` target.
3. Set your Apple Developer Team under Signing & Capabilities.
4. Confirm the bundle identifier. The placeholder is `io.lendori.losttofound`.
5. Build and run on a physical iPhone before TestFlight because the app uses device authentication.

## App Store Path

1. Enroll in the Apple Developer Program.
2. Create the app record in App Store Connect.
3. Configure signing, bundle identifier, app category, privacy details, age rating, and export compliance.
4. Archive from Xcode and upload to App Store Connect.
5. Use TestFlight for internal testing.
6. Submit for App Review after privacy/legal copy and screenshots are final.

## Native Value

Apple may reject a plain web wrapper under minimum-functionality review. This project is intentionally not just a website shortcut: it adds native app structure, device-level privacy lock, native policy/support surfaces, app icons, and App Store-ready metadata. Future native features that would strengthen review include native document import, local deadline reminders, push notifications, and native PDF/share workflows.
