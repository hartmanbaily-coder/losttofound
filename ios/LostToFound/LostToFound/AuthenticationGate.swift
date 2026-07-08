import LocalAuthentication
import SwiftUI

struct AuthenticationGate: View {
    let onUnlock: () -> Void

    @State private var errorMessage: String?
    @State private var isAuthenticating = false

    var body: some View {
        VStack(spacing: 28) {
            Spacer()

            Image(systemName: "lock.shield")
                .font(.system(size: 54, weight: .semibold))
                .foregroundStyle(Color("AccentColor"))

            VStack(spacing: 10) {
                Text("Lost to Found")
                    .font(.largeTitle.bold())

                Text("Unlock your private records workspace with Face ID, Touch ID, or your device passcode.")
                    .font(.body)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.callout)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
            }

            Button {
                Task { await authenticate() }
            } label: {
                Label(isAuthenticating ? "Unlocking" : "Unlock workspace", systemImage: "faceid")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(isAuthenticating)
            .padding(.horizontal, 32)

            Spacer()

            Text("This app organizes records only. It does not provide legal advice.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 24)
                .padding(.bottom, 20)
        }
        .task {
            await authenticate()
        }
    }

    @MainActor
    private func authenticate() async {
        guard !isAuthenticating else { return }

        #if targetEnvironment(simulator)
        onUnlock()
        return
        #else
        let context = LAContext()
        var authError: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &authError) else {
            errorMessage = "Turn on a device passcode before using this private records app."
            return
        }

        isAuthenticating = true
        errorMessage = nil

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: "Unlock your private records workspace."
            )
            if success {
                onUnlock()
            }
        } catch {
            errorMessage = "Authentication did not complete. Try again when you are ready."
        }

        isAuthenticating = false
        #endif
    }
}
