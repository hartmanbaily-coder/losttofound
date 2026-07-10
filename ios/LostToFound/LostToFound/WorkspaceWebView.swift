import Observation
import SwiftUI
import UIKit
import WebKit

@MainActor
@Observable
final class WebViewModel {
    var canGoBack = false
    var canGoForward = false
    var isLoading = false
    var loadErrorMessage: String?

    fileprivate weak var webView: WKWebView?
    private var initialRequest: URLRequest?

    func goBack() {
        webView?.goBack()
    }

    func goForward() {
        webView?.goForward()
    }

    func reload() {
        loadErrorMessage = nil

        if webView?.url != nil {
            webView?.reload()
        } else if let initialRequest {
            webView?.load(initialRequest)
        }
    }

    func retry() {
        loadErrorMessage = nil
        guard let webView, let initialRequest else { return }
        webView.load(initialRequest)
    }

    fileprivate func attach(_ webView: WKWebView, initialRequest: URLRequest) {
        self.webView = webView
        self.initialRequest = initialRequest
    }

    fileprivate func navigationStarted() {
        loadErrorMessage = nil
    }

    fileprivate func navigationFailed(with error: Error) {
        let error = error as NSError
        guard error.code != NSURLErrorCancelled else { return }

        if error.domain == NSURLErrorDomain {
            switch error.code {
            case NSURLErrorNotConnectedToInternet:
                loadErrorMessage = "Your device appears to be offline. Reconnect to the internet and try again."
            case NSURLErrorTimedOut:
                loadErrorMessage = "The connection timed out before the records workspace responded."
            case NSURLErrorCannotFindHost, NSURLErrorCannotConnectToHost, NSURLErrorNetworkConnectionLost:
                loadErrorMessage = "Lost to Found could not reach the records service. Check your connection and try again."
            case NSURLErrorSecureConnectionFailed, NSURLErrorServerCertificateUntrusted,
                 NSURLErrorServerCertificateHasBadDate, NSURLErrorServerCertificateHasUnknownRoot:
                loadErrorMessage = "A secure connection to Lost to Found could not be established."
            default:
                loadErrorMessage = "The records workspace could not be loaded. Please try again."
            }
            return
        }

        if error.domain == WKError.errorDomain,
           error.code == WKError.Code.navigationAppBoundDomain.rawValue {
            loadErrorMessage = "This link cannot open inside the secure records workspace."
            return
        }

        loadErrorMessage = "The records workspace could not be loaded. Please try again."
    }

    fileprivate func updateNavigationState(from webView: WKWebView) {
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
        isLoading = webView.isLoading
    }
}

struct WorkspaceScreen: View {
    private let workspaceURL = URL(string: "https://losttofound.org/records")!

    @State private var model = WebViewModel()

    var body: some View {
        ZStack {
            WorkspaceWebView(url: workspaceURL, model: model)

            if let loadErrorMessage = model.loadErrorMessage {
                ContentUnavailableView {
                    Label("Unable to Load Records", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(loadErrorMessage)
                } actions: {
                    Button {
                        model.retry()
                    } label: {
                        Label("Try Again", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .background(Color(uiColor: .systemBackground))
            }
        }
            .navigationTitle("Records")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .bottomBar) {
                    Button {
                        model.goBack()
                    } label: {
                        Label("Back", systemImage: "chevron.backward")
                    }
                    .disabled(!model.canGoBack)

                    Button {
                        model.goForward()
                    } label: {
                        Label("Forward", systemImage: "chevron.forward")
                    }
                    .disabled(!model.canGoForward)

                    Spacer()

                    if model.isLoading {
                        ProgressView()
                    } else {
                        Button {
                            model.reload()
                        } label: {
                            Label("Reload", systemImage: "arrow.clockwise")
                        }
                    }

                    ShareLink(item: workspaceURL) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                }
            }
    }
}

struct WorkspaceWebView: UIViewRepresentable {
    let url: URL
    let model: WebViewModel

    private let nativeDownloadHandlerName = "lostToFoundDownload"

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let websiteDataStore = WKWebsiteDataStore.default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.limitsNavigationsToAppBoundDomains = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.websiteDataStore = websiteDataStore
        configuration.applicationNameForUserAgent = "LostToFound-iOS/0.1"
        configuration.userContentController.add(
            WeakScriptMessageHandler(delegate: context.coordinator),
            name: nativeDownloadHandlerName
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.isInspectable = false
        webView.navigationDelegate = context.coordinator

        let request = URLRequest(
            url: url,
            cachePolicy: .reloadRevalidatingCacheData,
            timeoutInterval: 30
        )
        model.attach(webView, initialRequest: request)
        model.isLoading = true

        Task { @MainActor in
            await SecureSessionCookieStore.shared.prepare(websiteDataStore.httpCookieStore)
            webView.load(request)
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.updateNavigationState(from: webView)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        private let allowedHosts = Set(["losttofound.org", "www.losttofound.org"])
        private let allowedTextExportContentTypes = Set(["text/csv", "application/json"])
        private let maximumTextExportBytes = 10 * 1024 * 1024
        private let model: WebViewModel

        init(model: WebViewModel) {
            self.model = model
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "lostToFoundDownload",
                  message.frameInfo.isMainFrame,
                  let host = message.webView?.url?.host,
                  allowedHosts.contains(host),
                  let payload = message.body as? [String: Any],
                  let requestedFileName = payload["fileName"] as? String,
                  let body = payload["body"] as? String,
                  let contentType = payload["contentType"] as? String,
                  allowedTextExportContentTypes.contains(contentType),
                  body.utf8.count <= maximumTextExportBytes,
                  let data = body.data(using: .utf8),
                  let fileURL = writeTextExport(data: data, requestedFileName: requestedFileName)
            else {
                return
            }

            presentShareSheet(for: fileURL)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction
        ) async -> WKNavigationActionPolicy {
            guard let targetURL = navigationAction.request.url else {
                return .cancel
            }

            if targetURL.scheme == "mailto" {
                await MainActor.run {
                    UIApplication.shared.open(targetURL)
                }
                return .cancel
            }

            if targetURL.scheme == "https", let host = targetURL.host, allowedHosts.contains(host) {
                return .allow
            }

            if targetURL.scheme == "https" || targetURL.scheme == "http" {
                await MainActor.run {
                    UIApplication.shared.open(targetURL)
                }
                return .cancel
            }

            return .cancel
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.navigationStarted()
            model.updateNavigationState(from: webView)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.updateNavigationState(from: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            model.navigationFailed(with: error)
            model.updateNavigationState(from: webView)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            model.navigationFailed(with: error)
            model.updateNavigationState(from: webView)
        }

        private func writeTextExport(data: Data, requestedFileName: String) -> URL? {
            let allowedCharacters = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
            let safeFileName = requestedFileName.unicodeScalars
                .map { allowedCharacters.contains($0) ? String($0) : "-" }
                .joined()
                .prefix(160)
            guard !safeFileName.isEmpty else { return nil }

            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent("LostToFoundExports", isDirectory: true)
            let fileURL = directory.appendingPathComponent(String(safeFileName), isDirectory: false)

            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try data.write(to: fileURL, options: .atomic)
                return fileURL
            } catch {
                return nil
            }
        }

        private func presentShareSheet(for fileURL: URL) {
            guard let windowScene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }),
                  let rootViewController = windowScene.windows.first(where: \.isKeyWindow)?.rootViewController
            else {
                return
            }

            let presenter = visibleViewController(from: rootViewController)
            let shareSheet = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
            shareSheet.completionWithItemsHandler = { _, _, _, _ in
                try? FileManager.default.removeItem(at: fileURL)
            }

            if let popover = shareSheet.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = presenter.view.bounds
                popover.permittedArrowDirections = []
            }

            presenter.present(shareSheet, animated: true)
        }

        private func visibleViewController(from viewController: UIViewController) -> UIViewController {
            if let presented = viewController.presentedViewController {
                return visibleViewController(from: presented)
            }
            if let navigation = viewController as? UINavigationController,
               let visible = navigation.visibleViewController {
                return visibleViewController(from: visible)
            }
            if let tab = viewController as? UITabBarController,
               let selected = tab.selectedViewController {
                return visibleViewController(from: selected)
            }
            return viewController
        }
    }
}

private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}
