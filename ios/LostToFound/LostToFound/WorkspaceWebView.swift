import Observation
import SwiftUI
import WebKit

@MainActor
@Observable
final class WebViewModel {
    var canGoBack = false
    var canGoForward = false
    var isLoading = false

    fileprivate weak var webView: WKWebView?

    func goBack() {
        webView?.goBack()
    }

    func goForward() {
        webView?.goForward()
    }

    func reload() {
        webView?.reload()
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
        WorkspaceWebView(url: workspaceURL, model: model)
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

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.customUserAgent = "LostToFound-iOS/0.1"
        webView.navigationDelegate = context.coordinator

        model.webView = webView
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.updateNavigationState(from: webView)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let allowedHosts = Set(["losttofound.org", "www.losttofound.org"])
        private let model: WebViewModel

        init(model: WebViewModel) {
            self.model = model
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
            model.updateNavigationState(from: webView)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.updateNavigationState(from: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            model.updateNavigationState(from: webView)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            model.updateNavigationState(from: webView)
        }
    }
}
