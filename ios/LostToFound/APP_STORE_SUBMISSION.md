# App Store Submission Draft

This draft is a working submission packet. It should be reviewed before public submission, especially privacy, age rating, export compliance, and legal claims.

## App Identity

- App name: My Custody Case: Organizer
- Display name: My Case
- Bundle ID: `io.lendori.losttofound`
- Version: `0.1.0`
- Build: `1`
- Minimum iOS version: `17.0`
- Supported devices: iPhone and iPad
- Signing team: `HQG9VJ8JK2`
- SKU suggestion: `losttofound-ios`
- Primary category: Productivity
- Secondary category: Utilities
- Content rights: owned by the developer
- Support URL: `https://losttofound.org/contact`
- Privacy Policy URL: `https://losttofound.org/privacy`
- Terms URL: `https://losttofound.org/terms`

## Subtitle

Evidence, Logs & Court Reports

## Promotional Text Draft

Remove the emotion. Track the data. Organize custody events, parenting time, expenses, notes, and evidence in one private workspace.

## Description Draft

My Custody Case helps adult users privately organize custody records and supporting evidence.

Track dated notes, exchanges, FaceTime issues, expenses, files, calendar items, and clear reports from one place. The app is built for factual organization and personal recordkeeping. It helps users maintain cleaner records for personal review or attorney conversations.

Key features:

- Private records workspace for custody and parenting plan documentation
- Timeline, calendar, notes, and file organization
- Document upload support through the protected workspace
- Report and export workflows for review
- Device level unlock with Face ID, Touch ID, or passcode
- Controlled records web view limited to `losttofound.org` and `www.losttofound.org`
- Privacy, security, and AI data use notices available in app

Important boundaries:

- My Custody Case does not provide legal advice.
- My Custody Case is not a law firm and does not create an attorney client relationship.
- Users are responsible for verifying records against original source material.
- The app is for adult users only and is not directed to children.
- The app is not an emergency service, law enforcement tool, supervised exchange tool, or coparent messaging system.

## Keywords Draft

coparenting,parenting time,evidence,incident log,expenses,calendar,attorney,family court,records

## Review Notes Draft

My Custody Case is a private records organizer for adult users documenting custody and parenting plan information. It is not a legal advice app, law firm, emergency service, child facing app, social network, payment processor, or coparent messaging platform.

The app uses a native SwiftUI shell with a device-authentication gate, native tab navigation, native privacy/support surfaces, and a controlled `WKWebView` workspace. The web view is app-bound to `losttofound.org` and `www.losttofound.org`; external web links and `mailto:` links open outside the records workspace.

Review flow:

1. Launch the app.
2. Unlock with the review device's Face ID, Touch ID, or passcode. The app uses Apple's LocalAuthentication framework and does not receive or store biometric data.
3. Open the Records tab and sign in with the review account below.
4. Review the Policies tab for native privacy, terms, security, AI data use, subprocessors, accessibility, and contact links.
5. Review the Support tab for support contact, account/data help, and the in-app account deletion request entry point. The deletion entry point opens `https://losttofound.org/account/delete`, where a signed-in records user can submit an authenticated complete-account deletion request.

Provide Apple Review with a dedicated test account before submission:

- Email: `[create-app-review-test-account]`
- Password: `[create-secure-temporary-password]`
- MFA status: `[disable for review account or provide review instructions]`
- Test data: synthetic only

Account deletion path for review: Support tab -> Account and Data -> Request account deletion -> `https://losttofound.org/account/delete`. The direct deletion page lets a signed-in records user press "Submit account deletion request" to create a server-side authenticated deletion request, and also explains complete-account deletion, request timing, backup aging, legal/security retention, and support verification. The public Privacy Policy also documents retention, deletion, backup aging, and support requests.

Current native build snapshot:

- Product: `LostToFound.app`
- Bundle ID: `io.lendori.losttofound`
- Version/build: `0.1.0 (12)` in the project; App Store uploads use Xcode-managed next-available build numbering
- Deployment target: iOS 17.0
- Records URL: `https://losttofound.org/records`
- Account deletion URL: `https://losttofound.org/account/delete`
- Web navigation allowlist: `losttofound.org`, `www.losttofound.org`
- Scene privacy behavior: app returns to locked state when it leaves the active scene
- Automated verification: 6 native security tests passed with 0 failures on 2026-07-16, and an unsigned Release archive completed with store validation enabled

Do not submit to App Review until the production backend is ready for review access, including reviewed auth email delivery, auth redirect URLs, leaked-password protection, monitoring, backup/restore evidence, retention/deletion approval, and legal review.

## App Privacy Labels Draft

Use App Store Connect's current privacy questionnaire. Based on the current product, expect to disclose at least:

- Contact Info: email address for account/support.
- Identifiers: user ID or account identifier.
- User Content: notes, files, documents, message exports, calendar/timeline records, reports.
- Sensitive Info: custody, court, child-related, family, financial, or health-adjacent records may be entered by the user.
- Diagnostics: security events, logs, rate-limit events, and reliability diagnostics if collected.

Expected use purposes:

- App functionality
- Account management
- Security and fraud prevention
- Customer support
- Analytics/diagnostics only if explicitly enabled and documented

Expected tracking answer:

- No advertising tracking.
- No third-party advertising trackers.
- No selling custody records, evidence files, or account data.

Native authentication note:

- Face ID, Touch ID, and passcode checks are performed on device through LocalAuthentication.
- The app should not claim to collect biometric data unless another feature or vendor actually collects it.
- Keep App Store Connect privacy answers aligned with the live web workspace, support tooling, logging/monitoring, and any enabled AI import or malware scanning vendors.

Review the final privacy labels against the live implementation before submission.

## Age Rating Recommendation

Start with a conservative 17+ posture because users may store sensitive custody, family-court, financial, or child-related records, even though the app is adult-only and does not target children. Complete Apple's age-rating questionnaire based on final features.

## Export Compliance

The app uses standard HTTPS/TLS and account security. Complete Apple's encryption/export compliance questions in App Store Connect based on the final binary and counsel/account guidance.

## Screenshot Plan

Prepare screenshots for iPhone 6.9", iPhone 6.5", and iPad if supporting iPad:

1. Home/workspace overview with synthetic data only.
2. Timeline with synthetic records.
3. Calendar with synthetic parenting-plan colors.
4. Files/upload view with synthetic file names.
5. Report/export view with synthetic chart data.

Do not use real custody, child, court, message, phone, address, or evidence data in screenshots.

## Pre-Submission Checklist

- Apple Developer account active.
- Bundle ID created and assigned to the app.
- Signing team set in Xcode.
- App icon renders well at small sizes.
- TestFlight build installed on a real iPhone.
- App Review test account created with synthetic data.
- App Review notes include review-device unlock instructions and login/MFA instructions.
- Account deletion request path tested in the native Support tab and at `https://losttofound.org/account/delete`.
- Privacy Policy, Terms, Security, AI Data Use, Accessibility, and Contact pages live.
- No production secrets committed.
- No real user data in screenshots or demo account.
- Native app tested for login, MFA/recovery path, file upload, report export, and support links.
- Legal/privacy review complete before public launch.

## Apple References

- App Review Guidelines: `https://developer.apple.com/app-store/review/guidelines/`
- Apple Developer Program: `https://developer.apple.com/programs/`
- App Store Connect Help: `https://developer.apple.com/help/app-store-connect/`
- TestFlight overview: `https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/`
- App privacy details: `https://developer.apple.com/help/app-store-connect/manage-app-privacy/`
