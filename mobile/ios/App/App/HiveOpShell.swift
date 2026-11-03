import UIKit
import WebKit
import SafariServices
import Capacitor

/// Mirror of src/navPolicy.ts `decide`, fed by public/hiveop-shell.json (written by `npm run prepare`).
enum NavDecision { case inApp, sheet, deny }

struct ShellAsset: Decodable {
    let siteOrigin: String
    let authHosts: [String]
    let bridgeScripts: [String: String]

    static func load() -> ShellAsset? {
        guard let url = Bundle.main.url(forResource: "hiveop-shell", withExtension: "json", subdirectory: "public"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(ShellAsset.self, from: data)
    }

    static func origin(of url: URL) -> String {
        guard let scheme = url.scheme, let host = url.host else { return "" }
        let defaultPort = scheme == "https" ? 443 : 80
        let port = url.port.flatMap { $0 == defaultPort ? nil : $0 }
        return "\(scheme)://\(host)" + (port.map { ":\($0)" } ?? "")
    }

    func decide(_ url: URL) -> NavDecision {
        guard let scheme = url.scheme?.lowercased() else { return .deny }
        if scheme == "hiveop" { return .inApp }
        guard scheme == "http" || scheme == "https", url.host != nil else { return .deny }
        if ShellAsset.origin(of: url) == siteOrigin { return .inApp }
        if scheme == "https", url.port == nil, let host = url.host?.lowercased(), authHosts.contains(host) { return .inApp }
        return .sheet
    }
}

/// Opens outside pages in an SFSafariViewController over the app. The main web view never moves.
final class SheetPresenter {
    static func present(_ url: URL, from viewController: UIViewController?) {
        guard let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else { return }
        DispatchQueue.main.async {
            guard var top = viewController else { return }
            while let presented = top.presentedViewController { top = presented }
            if top is SFSafariViewController { return }
            let sheet = SFSafariViewController(url: url)
            sheet.preferredBarTintColor = UIColor(red: 0.043, green: 0.051, blue: 0.071, alpha: 1)
            sheet.preferredControlTintColor = .white
            sheet.dismissButtonStyle = .close
            top.present(sheet, animated: true)
        }
    }
}

/// Gets first say on every navigation (Capacitor asks plugins before its own allow-list).
@objc(HiveOpShellPlugin)
public final class HiveOpShellPlugin: CAPInstancePlugin, CAPBridgedPlugin {
    public let identifier = "HiveOpShellPlugin"
    public let jsName = "HiveOpShell"
    public let pluginMethods: [CAPPluginMethod] = []
    var asset: ShellAsset?

    @objc public override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let asset = asset, let url = navigationAction.request.url else { return nil }
        // Sub-frames (embeds) are left to Capacitor's default handling.
        if let target = navigationAction.targetFrame, !target.isMainFrame { return nil }
        // Local app pages (offline page, the app's own server URL) are not outside links.
        if url.scheme?.lowercased() == "capacitor" { return nil }
        switch asset.decide(url) {
        case .inApp: return nil
        case .deny: return true
        case .sheet:
            SheetPresenter.present(url, from: bridge?.viewController)
            return true
        }
    }
}

/// Forwards every WKUIDelegate call to Capacitor's handler except new-window requests
/// (target=_blank, window.open), which Capacitor would hand to Safari.
final class NewWindowUIDelegate: NSObject, WKUIDelegate {
    weak var original: WKUIDelegate?
    let asset: ShellAsset
    weak var viewController: UIViewController?

    init(original: WKUIDelegate?, asset: ShellAsset, viewController: UIViewController) {
        self.original = original
        self.asset = asset
        self.viewController = viewController
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, asset.decide(url) == .sheet {
            SheetPresenter.present(url, from: viewController)
        }
        // in-app targets, denied schemes, blank popups: never a second web view, never Safari.
        return nil
    }

    override func responds(to aSelector: Selector!) -> Bool {
        return super.responds(to: aSelector) || (original?.responds(to: aSelector) ?? false)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let original = original, original.responds(to: aSelector) { return original }
        return super.forwardingTarget(for: aSelector)
    }
}

/// Builds on MainViewController (MediaGate permissions): its gate becomes the "original" delegate we forward to.
class HiveOpViewController: MainViewController {
    private let asset = ShellAsset.load()
    private var uiDelegate: NewWindowUIDelegate?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let asset = asset, let webView = webView else { return }
        // Capacitor swaps in its own content controller after webViewConfiguration(for:), so the
        // bridge goes on the live one. Injected at document start; its own origin guard keeps it
        // off every page but the site.
        if let script = asset.bridgeScripts["ios"] {
            webView.configuration.userContentController.addUserScript(
                WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let plugin = HiveOpShellPlugin()
        plugin.asset = asset
        bridge?.registerPluginInstance(plugin)
        let proxy = NewWindowUIDelegate(original: webView.uiDelegate, asset: asset, viewController: self)
        uiDelegate = proxy
        webView.uiDelegate = proxy
    }
}
